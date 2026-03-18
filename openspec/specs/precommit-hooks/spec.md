## ADDED Requirements

### Requirement: Lefthook pre-commit hook runs Biome on staged files
The system SHALL run `biome check --staged` as a pre-commit git hook via lefthook. The hook SHALL block the commit if any lint or format violations are found in staged files.

#### Scenario: Clean staged files
- **WHEN** a developer commits files with no Biome violations
- **THEN** the commit succeeds without interruption

#### Scenario: Staged files with violations
- **WHEN** a developer commits files that contain lint or format violations
- **THEN** the commit is blocked and Biome outputs the violations to stderr

#### Scenario: Unstaged files with violations
- **WHEN** a developer commits clean staged files but has unstaged files with violations
- **THEN** the commit succeeds (only staged files are checked)

### Requirement: Lefthook auto-installs on pnpm install
The system SHALL configure a `postinstall` script that runs `lefthook install`, so hooks are activated automatically when dependencies are installed.

#### Scenario: Fresh clone and install
- **WHEN** a developer clones the repo and runs `pnpm install`
- **THEN** lefthook git hooks are installed in `.git/hooks/`

### Requirement: NPM scripts for manual Biome execution
The root `package.json` SHALL include `lint`, `lint:fix`, and `format` scripts for running Biome manually.

#### Scenario: Run lint check
- **WHEN** a developer runs `pnpm lint`
- **THEN** Biome checks all files and reports violations without modifying files

#### Scenario: Run lint fix
- **WHEN** a developer runs `pnpm lint:fix`
- **THEN** Biome fixes all auto-fixable violations in place

#### Scenario: Run format
- **WHEN** a developer runs `pnpm format`
- **THEN** Biome formats all files in place
