import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export interface UpstreamConfig {
  readonly repository: string;
  readonly tag: string;
}

export interface PrepareOptions {
  readonly repoRoot: string;
  readonly repository: string;
  readonly tag: string;
  readonly targetDir: string;
  readonly patchDir: string;
  readonly skipClone: boolean;
  readonly checkOnly: boolean;
  readonly dryRun: boolean;
}

const TAG_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/;
const ALLOWED_REPO_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/;

export function loadUpstreamConfig(repoRoot: string): UpstreamConfig {
  const configPath = path.join(repoRoot, "build", "upstream.json");
  const raw = JSON.parse(readFileSync(configPath, "utf8")) as Partial<UpstreamConfig>;
  if (!raw.repository || !ALLOWED_REPO_PATTERN.test(raw.repository)) {
    throw new Error(`Invalid upstream repository URL in build/upstream.json: ${String(raw.repository)}`);
  }
  if (!raw.tag || !TAG_PATTERN.test(raw.tag)) {
    throw new Error(`Invalid upstream release tag in build/upstream.json: ${String(raw.tag)}`);
  }
  return { repository: raw.repository, tag: raw.tag };
}

export function parseArgs(argv: readonly string[], repoRoot: string): PrepareOptions {
  const defaults = loadUpstreamConfig(repoRoot);
  let tag = defaults.tag;
  let targetDir = path.join(repoRoot, ".upstream", "vscode");
  let patchDir = path.join(repoRoot, "patches");
  let skipClone = false;
  let checkOnly = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tag") {
      const next = argv[++i];
      if (!next || !TAG_PATTERN.test(next)) {
        throw new Error(`Invalid --tag value: ${String(next)}`);
      }
      tag = next;
    } else if (arg === "--target") {
      const next = argv[++i];
      if (!next) {
        throw new Error("--target requires a directory path");
      }
      targetDir = path.resolve(repoRoot, next);
    } else if (arg === "--patch-dir") {
      const next = argv[++i];
      if (!next) {
        throw new Error("--patch-dir requires a directory path");
      }
      patchDir = path.resolve(repoRoot, next);
    } else if (arg === "--skip-clone") {
      skipClone = true;
    } else if (arg === "--check-only") {
      checkOnly = true;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    repoRoot,
    repository: defaults.repository,
    tag,
    targetDir,
    patchDir,
    skipClone,
    checkOnly,
    dryRun,
  };
}

function printUsage(): void {
  console.log(
    [
      "Usage: node build/scripts/prepare-source.ts [options]",
      "",
      "Options:",
      "  --tag <semver>       Override upstream Code-OSS release tag from build/upstream.json",
      "  --target <dir>       Target checkout directory (default: .upstream/vscode)",
      "  --patch-dir <dir>    Directory containing differential .patch files (default: patches)",
      "  --skip-clone         Reuse existing target checkout instead of cloning",
      "  --check-only         Verify patches with git apply --check without modifying target",
      "  --dry-run            Print planned actions without executing git or file writes",
      "  -h, --help           Show this help message",
    ].join("\n")
  );
}

function runGit(args: readonly string[], cwd?: string): void {
  execFileSync("git", [...args], {
    cwd,
    shell: false,
    stdio: "inherit",
  });
}

export function listPatchFiles(patchDir: string): string[] {
  if (!existsSync(patchDir)) {
    return [];
  }
  return readdirSync(patchDir)
    .filter((name) => name.endsWith(".patch"))
    .sort()
    .map((name) => path.join(patchDir, name));
}

function ensureUpstreamCheckout(options: PrepareOptions): void {
  const gitDir = path.join(options.targetDir, ".git");
  if (options.skipClone) {
    if (!existsSync(gitDir)) {
      throw new Error(`--skip-clone specified, but no git repository found at ${options.targetDir}`);
    }
    runGit(["checkout", "--", "."], options.targetDir);
    runGit(["clean", "-fd"], options.targetDir);
    return;
  }

  if (existsSync(gitDir)) {
    console.log(`[prepare-source] Resetting existing checkout at ${options.targetDir} to tag ${options.tag}...`);
    runGit(["checkout", "--", "."], options.targetDir);
    runGit(["clean", "-fd"], options.targetDir);
    runGit(["fetch", "--depth", "1", "origin", "tag", options.tag, "--force"], options.targetDir);
    runGit(["checkout", "--detach", `tags/${options.tag}`], options.targetDir);
    return;
  }

  if (existsSync(options.targetDir)) {
    rmSync(options.targetDir, { recursive: true, force: true });
  }
  mkdirSync(path.dirname(options.targetDir), { recursive: true });
  console.log(`[prepare-source] Cloning ${options.repository} (tag ${options.tag}) -> ${options.targetDir}...`);
  runGit(["clone", "--depth", "1", "--branch", options.tag, "--single-branch", options.repository, options.targetDir]);
}

function applyPatches(options: PrepareOptions, patches: readonly string[]): void {
  for (const patchPath of patches) {
    const label = path.relative(options.repoRoot, patchPath);
    if (options.checkOnly) {
      console.log(`[prepare-source] Checking patch: ${label}`);
      runGit(["apply", "--check", "--whitespace=nowarn", patchPath], options.targetDir);
    } else {
      console.log(`[prepare-source] Applying patch: ${label}`);
      runGit(["apply", "--whitespace=nowarn", patchPath], options.targetDir);
    }
  }
}

function overlayBrandingAssets(options: PrepareOptions): void {
  const productSrc = path.join(options.repoRoot, "product.json");
  const productDest = path.join(options.targetDir, "product.json");
  copyFileSync(productSrc, productDest);
  console.log("[prepare-source] Overlaid product.json (Open VSX + zero telemetry)");

  const iconMappings: ReadonlyArray<readonly [string, string]> = [
    ["assets/icons/code.png", "resources/linux/code.png"],
    ["assets/icons/code.ico", "resources/win32/code.ico"],
    ["assets/icons/code_150x150.png", "resources/win32/code_150x150.png"],
    ["assets/icons/code_70x70.png", "resources/win32/code_70x70.png"],
  ];

  for (const [srcRel, destRel] of iconMappings) {
    const src = path.join(options.repoRoot, srcRel);
    const dest = path.join(options.targetDir, destRel);
    if (existsSync(src)) {
      mkdirSync(path.dirname(dest), { recursive: true });
      copyFileSync(src, dest);
      console.log(`[prepare-source] Overlaid icon: ${destRel}`);
    }
  }
}

export function prepareSource(options: PrepareOptions): void {
  const patches = listPatchFiles(options.patchDir);
  if (patches.length === 0) {
    throw new Error(`No .patch files found in ${options.patchDir}`);
  }

  if (options.dryRun) {
    console.log("[prepare-source] Dry run:");
    console.log(`  Repository: ${options.repository}`);
    console.log(`  Tag:        ${options.tag}`);
    console.log(`  Target:     ${options.targetDir}`);
    console.log(`  Patches:    ${patches.map((p) => path.basename(p)).join(", ")}`);
    return;
  }

  ensureUpstreamCheckout(options);
  applyPatches(options, patches);

  if (!options.checkOnly) {
    overlayBrandingAssets(options);
  }
  console.log("[prepare-source] Done.");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  const repoRoot = path.resolve(path.dirname(currentFile), "..", "..");
  const options = parseArgs(process.argv.slice(2), repoRoot);
  prepareSource(options);
}
