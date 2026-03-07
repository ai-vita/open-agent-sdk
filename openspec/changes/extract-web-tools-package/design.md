## Context

`@open-agent-sdk/tools` bundles six core filesystem/shell tools (Bash, Read, Write, Edit, Glob, Grep) alongside two web tools (WebFetch, WebSearch) that require `parallel-web`. The web tools are optional features gated behind `AgentToolsConfig.webFetch` / `AgentToolsConfig.webSearch`. Because `parallel-web` is a large SDK not needed by most consumers, it is declared as an optional peer dependency — which requires consumers to install it separately and forces the implementation to use `await import("parallel-web")` with a try/catch to handle the missing-package case. This pattern duplicates the internal module-cache boilerplate across both files and makes the type of the `parallel-web` module opaque.

The existing packages (`sandbox-e2b`, `sandbox-vercel`) each follow the model of one package = one SDK dependency. The web tools should do the same.

## Goals / Non-Goals

**Goals:**
- Create `packages/tools-web/` as a new workspace package `@open-agent-sdk/tools-web`
- `parallel-web` is a regular `dependency` in `tools-web` — static import, no try/catch, full type inference
- Mirror the existing `createWebFetchTool` / `createWebSearchTool` API exactly so migration is a one-line import change
- Remove `WebFetch`, `WebSearch`, `webFetch`, `webSearch`, and the `parallel-web` peer dep from `@open-agent-sdk/tools`
- Both packages build and typecheck independently

**Non-Goals:**
- Changing any web tool behavior or their schemas
- Introducing a combined `createWebTools()` factory (keep it simple)
- Providing backwards-compat re-exports from `@open-agent-sdk/tools` (clean break)

## Decisions

### Decision 1: New package, not a sub-path export

**Choice:** `@open-agent-sdk/tools-web` as a separate npm package, not `@open-agent-sdk/tools/web`.

**Rationale:** Sub-path exports would still require `parallel-web` to be present in the tools package (even if unused), defeating the goal of a clean separation. A separate package has its own `package.json`, its own `dependencies`, and is independently installable. This matches the established pattern in the workspace (`sandbox-e2b`, `sandbox-vercel` are separate packages).

**Alternatives considered:**
- *Sub-path export `@open-agent-sdk/tools/web`:* Cleaner import path for consumers, but `parallel-web` would still live in `@open-agent-sdk/tools`'s dependency tree. Doesn't solve the peer dep problem.
- *Keep both tools in tools and tools-web (re-export):* Avoids a breaking change but creates duplication and perpetuates the optional-peer-dep pattern. Not worth it.

### Decision 2: Static top-level import of parallel-web

**Choice:** `import Parallel from "parallel-web"` at module top level in both `web-fetch.ts` and `web-search.ts` within the new package.

**Rationale:** `parallel-web` is a required regular dependency in `tools-web`. The dynamic import / lazy cache pattern (`let parallelModule`, `getParallelModule()`) exists solely because the dep was optional and might be missing. With a regular dep, it cannot be missing — static import is correct, simpler, and gives full TypeScript types.

### Decision 3: Package structure mirrors tools-web pattern

**Choice:** `packages/tools-web/src/` with `web-fetch.ts`, `web-search.ts`, and `index.ts` (barrel). Build config mirrors `@open-agent-sdk/tools` (tsup, ESM + CJS).

**Rationale:** Consistency with the rest of the monorepo. Consumers familiar with the tools package will find the same structure.

### Decision 4: Breaking removal from tools

**Choice:** Delete `web-fetch.ts` and `web-search.ts` from `packages/tools/src/`, remove their exports from `packages/tools/src/index.ts`, and remove `webFetch`/`webSearch` from `AgentToolsConfig`.

**Rationale:** Re-exporting from `tools-web` would require `tools` to declare `tools-web` as a dependency (which pulls in `parallel-web` anyway). The point is clean separation. The migration for consumers is minimal: change one import line.

## Risks / Trade-offs

- [Breaking change] Consumers importing `createWebFetchTool` / `createWebSearchTool` from `@open-agent-sdk/tools` must update to `@open-agent-sdk/tools-web`. → Document in CHANGELOG; migration is mechanical.
- [Two packages to install] Consumers wanting both core tools and web tools now install two packages. → This is intentional — they only pay for what they use.
