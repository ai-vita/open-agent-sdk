## ADDED Requirements

### Requirement: Root package.json exists
The project SHALL have a root `package.json` with `"private": true` and a `name` field set to `"open-agent-sdk"`. It SHALL include a `packageManager` field specifying pnpm v10+.

#### Scenario: Root package.json is valid
- **WHEN** a developer clones the repository
- **THEN** a `package.json` exists at the project root with `"private": true`, `"name": "open-agent-sdk"`, and a `packageManager` field matching `pnpm@10.x.x`

### Requirement: pnpm-workspace.yaml defines workspace packages
The project SHALL have a `pnpm-workspace.yaml` file at the root that includes `packages/*` as a workspace glob pattern.

#### Scenario: Workspace configuration is present
- **WHEN** `pnpm install` is run at the project root
- **THEN** pnpm recognizes the workspace and resolves packages from the `packages/` directory

#### Scenario: Empty workspace installs without error
- **WHEN** the `packages/` directory is empty or contains no valid packages
- **THEN** `pnpm install` completes successfully without errors

### Requirement: .npmrc enforces strict dependency resolution
The project SHALL have an `.npmrc` file at the root with `strict-peer-dependencies=true`.

#### Scenario: Peer dependency violations are caught
- **WHEN** a package declares an unmet peer dependency
- **THEN** `pnpm install` fails with an error indicating the missing peer dependency

### Requirement: Packages directory exists
The project SHALL have a `packages/` directory at the root to house workspace packages. A `.gitkeep` file SHALL be present to ensure the empty directory is tracked by git.

#### Scenario: Packages directory is tracked
- **WHEN** a developer clones the repository
- **THEN** a `packages/` directory exists at the project root
