import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { listPatchFiles, loadUpstreamConfig, parseArgs, prepareSource } from "../build/scripts/prepare-source.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("loadUpstreamConfig pins a stable release tag", () => {
  const cfg = loadUpstreamConfig(repoRoot);
  assert.equal(cfg.repository, "https://github.com/microsoft/vscode.git");
  assert.match(cfg.tag, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  assert.notEqual(cfg.tag, "main");
});

test("parseArgs accepts overrides and rejects invalid tags", () => {
  const opts = parseArgs(["--tag", "1.147.0", "--dry-run", "--skip-clone"], repoRoot);
  assert.equal(opts.tag, "1.147.0");
  assert.equal(opts.dryRun, true);
  assert.equal(opts.skipClone, true);
  assert.throws(() => parseArgs(["--tag", "main"], repoRoot), /Invalid --tag/);
});

test("differential patches exist and dry-run succeeds", () => {
  const patches = listPatchFiles(path.join(repoRoot, "patches")).map((p) => path.basename(p));
  assert.ok(patches.includes("disable-telemetry.patch"));
  assert.ok(patches.includes("branding.patch"));

  const telemetryPatch = readFileSync(path.join(repoRoot, "patches", "disable-telemetry.patch"), "utf8");
  assert.match(telemetryPatch, /NullTelemetryService/);
  assert.match(telemetryPatch, /supportsTelemetry/);

  const brandingPatch = readFileSync(path.join(repoRoot, "patches", "branding.patch"), "utf8");
  assert.match(brandingPatch, /Koality Assured IDE/);

  const opts = parseArgs(["--dry-run"], repoRoot);
  assert.doesNotThrow(() => prepareSource(opts));
  assert.equal(existsSync(path.join(repoRoot, "assets", "icons", "code.ico")), true);
});
