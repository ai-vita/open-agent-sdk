## Why

`@open-agent-sdk/tools` currently includes `WebFetch` and `WebSearch` tools that depend on `parallel-web`, declared as an optional peer dependency. This creates friction: consumers who don't need web tools still see peer dep warnings, and those who do need them must separately install `parallel-web` and deal with a dynamic `await import()` pattern with its associated type complexity. The tools belong in their own package where `parallel-web` is a plain regular dependency — clean install, no peer deps, no dynamic imports.

## What Changes

- Create new package `@open-agent-sdk/tools-web` containing `WebFetch` and `WebSearch` tools
- `parallel-web` is a regular `dependency` in the new package (not peer, not optional)
- Replace dynamic `await import("parallel-web")` with a top-level static import
- Remove `WebFetch` and `WebSearch` exports from `@open-agent-sdk/tools` **BREAKING**
- Remove `parallel-web` peer dependency from `@open-agent-sdk/tools`
- Remove `webSearch` and `webFetch` options from `AgentToolsConfig` in `@open-agent-sdk/tools` **BREAKING**
- The new package exports `createWebSearchTool`, `createWebFetchTool`, and their config/result types, mirroring the existing API

## Capabilities

### New Capabilities

- `web-tools-package`: A standalone `@open-agent-sdk/tools-web` package providing `WebFetch` and `WebSearch` tools with `parallel-web` as a bundled regular dependency

### Modified Capabilities

None — tool behavior is unchanged; this is a packaging reorganisation.

## Impact

- **New package**: `packages/tools-web/` added to workspace
- **Breaking**: `@open-agent-sdk/tools` no longer exports `createWebFetchTool`, `createWebFetchConfig`, `createWebSearchTool`, `WebSearchConfig`, or includes `webFetch`/`webSearch` in `AgentToolsConfig`
- Consumers using web tools update their import from `@open-agent-sdk/tools` to `@open-agent-sdk/tools-web`
- Consumers not using web tools benefit from a leaner `@open-agent-sdk/tools` with no peer dep warnings
