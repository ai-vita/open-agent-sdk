## ADDED Requirements

### Requirement: Packages use composite TypeScript configuration
Each package's `tsconfig.json` SHALL set `composite: true` to enable TypeScript project references.

#### Scenario: Package tsconfig enables composite
- **WHEN** a package's `tsconfig.json` is inspected
- **THEN** it contains `"composite": true` in `compilerOptions`

### Requirement: Root tsconfig declares project references
A root `tsconfig.json` SHALL exist with `references` entries pointing to all workspace packages.

#### Scenario: Root tsconfig references all packages
- **WHEN** the root `tsconfig.json` is inspected
- **THEN** it contains a `references` array with a `path` entry for each package in `packages/`

### Requirement: Cross-package dependencies declare references
When a package depends on another workspace package, its `tsconfig.json` SHALL include a `references` entry for that dependency.

#### Scenario: Dependent package references its dependency
- **WHEN** package A imports from package B (a workspace dependency)
- **THEN** package A's `tsconfig.json` contains a `references` entry with `"path": "../B"`
