## Why

Biome is installed and configured (`biome.json`) but nothing enforces it. There are no npm scripts to run it, no git hooks to catch issues before commit, and no CI pipeline to gate merges. Code style and lint violations can slip in silently.

## What Changes

- Add `lint`, `lint:fix`, and `format` scripts to root `package.json`
- Install and configure [lefthook](https://github.com/evilmartians/lefthook) as the git hook manager
- Configure pre-commit hook to run `biome check --staged` (staged files only, for speed)
- Add a GitHub Actions CI workflow that runs `biome ci .` on PRs and pushes to main

## Capabilities

### New Capabilities
- `precommit-hooks`: Lefthook configuration for git pre-commit hooks running Biome on staged files
- `ci-pipeline`: GitHub Actions workflow for linting, type-checking, and testing

### Modified Capabilities

None.

## Impact

- **Dependencies**: Adds `lefthook` as a devDependency
- **Developer workflow**: Developers will need to run `pnpm install` to activate lefthook's auto-install. Biome violations in staged files will block commits.
- **CI**: New `.github/workflows/ci.yml` will run on PRs and pushes to main
- **package.json**: New scripts added at root level
