# web-tools-package Specification

## Purpose

Provide WebFetch and WebSearch tools in a standalone package with parallel-web as a bundled dependency, removing optional peer dependency friction from the main tools package.

## Requirements
### Requirement: tools-web package exists as standalone workspace package
A new package `@open-agent-sdk/tools-web` SHALL exist at `packages/tools-web/` in the monorepo workspace with its own `package.json`, build config, and source files.

#### Scenario: Package is independently installable
- **WHEN** a consumer runs `npm install @open-agent-sdk/tools-web`
- **THEN** `parallel-web` is installed automatically as a transitive dependency with no peer dep warnings

#### Scenario: parallel-web is a regular dependency
- **WHEN** inspecting `packages/tools-web/package.json`
- **THEN** `parallel-web` appears under `dependencies`, not `peerDependencies`

### Requirement: tools-web uses static import for parallel-web
The `tools-web` package SHALL import `parallel-web` via a top-level static import statement.

#### Scenario: No dynamic import at runtime
- **WHEN** the `tools-web` module is loaded
- **THEN** `parallel-web` is resolved at module load time without `await import()`, try/catch, or a lazy module cache variable

### Requirement: tools-web exports WebFetch and WebSearch tools
The `@open-agent-sdk/tools-web` package SHALL export `createWebFetchTool`, `WebFetchConfig`, `createWebSearchTool`, and `WebSearchConfig` with identical signatures to the current exports in `@open-agent-sdk/tools`.

#### Scenario: Drop-in import replacement
- **WHEN** a consumer changes `import { createWebFetchTool } from "@open-agent-sdk/tools"` to `import { createWebFetchTool } from "@open-agent-sdk/tools-web"`
- **THEN** the tool behaves identically with no other code changes required

### Requirement: WebFetch and WebSearch removed from tools package
`@open-agent-sdk/tools` SHALL NOT export `createWebFetchTool`, `WebFetchConfig`, `createWebSearchTool`, or `WebSearchConfig` after this change.

#### Scenario: Removed exports cause compile error
- **WHEN** a consumer imports `createWebFetchTool` from `@open-agent-sdk/tools`
- **THEN** TypeScript reports a compile-time error (module has no exported member)

### Requirement: AgentToolsConfig removes web tool options
The `AgentToolsConfig` interface in `@open-agent-sdk/tools` SHALL NOT include `webFetch` or `webSearch` fields after this change.

#### Scenario: createAgentTools no longer accepts web config
- **WHEN** a consumer passes `webFetch` or `webSearch` to `createAgentTools()`
- **THEN** TypeScript reports a compile-time error (object literal may only specify known properties)

### Requirement: parallel-web peer dependency removed from tools
`@open-agent-sdk/tools` SHALL NOT declare `parallel-web` in `peerDependencies` or `peerDependenciesMeta`.

#### Scenario: Clean install with no peer warnings
- **WHEN** a consumer installs only `@open-agent-sdk/tools`
- **THEN** no peer dependency warnings about `parallel-web` are emitted

