## Why

This project currently has no package management or workspace structure. Initializing a pnpm workspace establishes the foundation for organizing code into packages, managing dependencies, and enabling monorepo development workflows.

## What Changes

- Add root `package.json` with workspace configuration
- Add `pnpm-workspace.yaml` defining workspace package locations
- Configure root-level scripts and shared dev dependencies
- Set up initial workspace directory structure (e.g., `packages/`)

## Capabilities

### New Capabilities
- `pnpm-workspace`: Core pnpm workspace configuration including root package.json, pnpm-workspace.yaml, and directory conventions for packages

### Modified Capabilities
<!-- None — this is a greenfield setup -->

## Impact

- Introduces `package.json`, `pnpm-workspace.yaml`, and `.npmrc` at the project root
- Requires pnpm to be installed (v10+)
- All future packages will live under the workspace structure
- Sets conventions for dependency management across the monorepo
