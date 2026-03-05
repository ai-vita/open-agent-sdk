## Context

The project (`open-agent-sdk`) is currently an empty repository with only an `openspec/` directory. There is no package manager configuration, no dependency management, and no workspace structure. We need to establish a pnpm monorepo foundation that future packages will build on.

## Goals / Non-Goals

**Goals:**
- Establish a pnpm workspace with a root `package.json` and `pnpm-workspace.yaml`
- Define a `packages/` directory convention for workspace packages
- Configure `.npmrc` with sensible defaults for monorepo development
- Ensure the setup works with pnpm v9+

**Non-Goals:**
- Creating any actual packages within the workspace (that's a separate change)
- Setting up build tooling (TypeScript, bundlers, etc.)
- CI/CD pipeline configuration
- Publishing configuration

## Decisions

### 1. Package directory convention: `packages/*`

Use a single `packages/` directory for all workspace packages.

**Alternatives considered:**
- Multiple top-level directories (`libs/`, `apps/`, `tools/`) — more complex, premature without knowing the project shape
- Flat structure — doesn't scale for a monorepo

**Rationale:** Single `packages/` is the simplest starting point. Can be expanded later by adding more glob patterns to `pnpm-workspace.yaml`.

### 2. pnpm v9+ as minimum version

Target pnpm v10 which is the current stable major version (latest: 10.30.3).

**Rationale:** v10 is the latest major version with the best workspace support, improved peer dependency handling, and active maintenance. As a greenfield project there's no reason to target an older major.

### 3. `.npmrc` configuration

Set `shamefully-hoist=false` (default) and `strict-peer-dependencies=true` to enforce clean dependency boundaries between packages.

**Rationale:** Strict mode catches dependency issues early. This is the recommended approach for monorepos to prevent phantom dependencies.

## Risks / Trade-offs

- **[Risk] pnpm not installed** → Document pnpm as a prerequisite; add `packageManager` field in root `package.json` for corepack support
- **[Risk] Future restructuring needed** → Mitigated by keeping the initial structure minimal; adding more workspace globs is non-breaking
