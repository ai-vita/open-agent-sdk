## ADDED Requirements

### Requirement: CI workflow runs on PRs and main pushes
The system SHALL have a GitHub Actions workflow that triggers on pull requests to `main` and pushes to `main`.

#### Scenario: PR opened
- **WHEN** a pull request is opened or updated targeting `main`
- **THEN** the CI workflow runs

#### Scenario: Push to main
- **WHEN** code is pushed directly to `main`
- **THEN** the CI workflow runs

### Requirement: CI runs Biome, typecheck, and tests
The CI workflow SHALL run `biome ci .`, `pnpm typecheck`, and `pnpm test` as separate steps. A failure in any step SHALL fail the workflow.

#### Scenario: Biome violation in PR
- **WHEN** a PR contains files with lint or format violations
- **THEN** the CI workflow fails at the Biome step

#### Scenario: Type error in PR
- **WHEN** a PR contains TypeScript type errors
- **THEN** the CI workflow fails at the typecheck step

#### Scenario: All checks pass
- **WHEN** a PR has no lint violations, type errors, or test failures
- **THEN** the CI workflow succeeds

### Requirement: CI uses pnpm with caching
The CI workflow SHALL use pnpm for package installation and cache pnpm's store for faster subsequent runs.

#### Scenario: Repeated CI runs
- **WHEN** CI runs multiple times with the same dependencies
- **THEN** pnpm store is restored from cache, reducing install time
