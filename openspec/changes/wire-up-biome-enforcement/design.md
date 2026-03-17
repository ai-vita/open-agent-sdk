## Context

The project has `@biomejs/biome` installed and a `biome.json` config with recommended lint rules and formatting. However, nothing invokes Biome — no npm scripts, no git hooks, no CI. The project uses pnpm workspaces.

## Goals / Non-Goals

**Goals:**
- Enforce Biome lint + format on every commit (staged files only)
- Enforce Biome in CI as a merge gate
- Provide convenient npm scripts for manual runs

**Non-Goals:**
- Configuring additional Biome rules beyond what's already in `biome.json`
- Adding test execution to the pre-commit hook (keep it fast)
- Supporting non-pnpm package managers

## Decisions

### 1. Lefthook for git hooks

**Choice**: lefthook over husky + lint-staged

**Rationale**: Lefthook is a single Go binary with no Node.js runtime dependency for hook execution. It has built-in staged file glob support (`staged_files`), eliminating the need for a separate lint-staged package. Configuration is a single YAML file. It auto-installs hooks via a `postinstall` script — no manual `npx lefthook install` needed.

**Alternatives considered**:
- **husky + lint-staged**: Most common, but requires two packages and more config files. Husky v9+ also requires a `.husky/` directory with shell scripts.
- **simple-git-hooks**: Minimal but no built-in staged-file filtering.

### 2. Biome `check --staged` for pre-commit

**Choice**: `biome check --staged` in the pre-commit hook

**Rationale**: Biome natively supports `--staged` which checks only git-staged files. This is faster than checking the entire repo and only blocks on code the developer is actually committing. The `check` subcommand runs both linting and formatting validation.

### 3. Biome `ci` for GitHub Actions

**Choice**: `biome ci .` in the CI workflow

**Rationale**: `biome ci` is the dedicated CI command — it runs the same checks as `biome check` but outputs in a CI-friendly format (no interactive features, non-zero exit on any issue). The CI workflow will also run `typecheck` and `test` to form a complete gate.

### 4. Lefthook auto-install via postinstall

**Choice**: Add `"postinstall": "lefthook install"` to root `package.json`

**Rationale**: This ensures any developer running `pnpm install` automatically gets hooks configured. No manual step needed. Standard pattern recommended by lefthook docs.

## Risks / Trade-offs

- **Existing code may have violations** → Run `biome check --write .` once to fix existing issues before merging this change. Include this as a task.
- **Lefthook requires Go binary download** → Lefthook publishes npm wrapper packages that download the correct binary automatically. No Go toolchain needed.
- **Pre-commit adds latency** → Mitigated by checking only staged files. Biome is extremely fast (written in Rust), typically <100ms for staged-only checks.
