## 1. NPM Scripts

- [x] 1.1 Add `lint`, `lint:fix`, and `format` scripts to root `package.json`
  - `lint`: `biome check .`
  - `lint:fix`: `biome check --write .`
  - `format`: `biome format --write .`

## 2. Lefthook Setup

- [x] 2.1 Install `lefthook` as a devDependency (`pnpm add -D lefthook`)
- [x] 2.2 Add `"postinstall": "lefthook install"` to root `package.json` scripts
- [x] 2.3 Create `lefthook.yml` at project root with pre-commit hook running `biome check --staged`

## 3. CI Pipeline

- [x] 3.1 Create `.github/workflows/ci.yml` with triggers on PR to main and push to main
- [x] 3.2 Configure pnpm setup with store caching using `pnpm/action-setup` and `actions/setup-node` with cache
- [x] 3.3 Add steps: install deps, `biome ci .`, `pnpm typecheck`, `pnpm test`

## 4. Fix Existing Violations

- [x] 4.1 Run `biome check --write .` to auto-fix all existing violations
- [x] 4.2 Review and manually fix any violations that can't be auto-fixed
