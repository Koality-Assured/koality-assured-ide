# Contributing to Koality Assured IDE

Thanks for contributing to `koality-assured-ide`.

## Repository Model

`koality-assured-ide` uses a **Patch-and-Overlay** architecture over pinned `microsoft/vscode` (`Code-OSS`) release tags:

- Keep differential patches under `patches/` minimal, focused, and clearly scoped.
- Build custom AI orchestration and harness UI in built-in extensions and the external Harness ACP daemon (`harness-cli`), rather than invasive core workbench forks.
- Never add Microsoft trademarks, proprietary Microsoft Marketplace endpoints, or telemetry services. All extension gallery resolution routes exclusively to Open VSX (`https://open-vsx.org/vscode/gallery`).

## Development Workflow

1. Fork or branch from `main` using a descriptive branch name (`feat/...`, `fix/...`, `docs/...`).
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages and PR titles (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`).
3. Run local checks before opening a pull request:

```bash
npm ci
npm run lint
npm run lint:md
npm test
```

## Security & Credentials

- Never commit secrets, API keys, tokens, or personal data.
- See [SECURITY.md](SECURITY.md) for reporting vulnerabilities privately.
