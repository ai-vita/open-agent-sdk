## 1. Scaffold tools-web Package

- [ ] 1.1 Create `packages/tools-web/` directory
- [ ] 1.2 Create `packages/tools-web/package.json` modeled after `packages/tools/package.json` — name `@open-agent-sdk/tools-web`, with `parallel-web` and `@open-agent-sdk/core` as regular `dependencies`, `ai` and `zod` as peer dependencies (matching tools package)
- [ ] 1.3 Create `packages/tools-web/tsconfig.json` (copy from `packages/tools/tsconfig.json`, adjust paths if needed)
- [ ] 1.4 Create `packages/tools-web/tsup.config.ts` (copy from `packages/tools/tsup.config.ts`)
- [ ] 1.5 Add `packages/tools-web` to the workspace `pnpm-workspace.yaml` (if not auto-discovered by glob)

## 2. Implement tools-web Source

- [ ] 2.1 Create `packages/tools-web/src/web-fetch.ts` — copy from `packages/tools/src/web-fetch.ts`, replace the dynamic `getParallelModule()` pattern with a top-level static `import Parallel from "parallel-web"`; remove the `let parallelModule` cache variable and lazy loader
- [ ] 2.2 Create `packages/tools-web/src/web-search.ts` — same treatment as web-fetch
- [ ] 2.3 Create `packages/tools-web/src/index.ts` exporting `createWebFetchTool`, `WebFetchConfig`, `WebFetchOutput`, `WebFetchError`, `createWebSearchTool`, `WebSearchConfig`, `WebSearchOutput`, `WebSearchResult`, `WebSearchError`
- [ ] 2.4 Run `pnpm typecheck` in `packages/tools-web` — fix any type errors
- [ ] 2.5 Run `pnpm build` in `packages/tools-web` — confirm build succeeds

## 3. Remove Web Tools from tools Package

- [ ] 3.1 Delete `packages/tools/src/web-fetch.ts`
- [ ] 3.2 Delete `packages/tools/src/web-search.ts`
- [ ] 3.3 Remove `createWebFetchTool`, `WebFetchConfig` imports and exports from `packages/tools/src/index.ts`
- [ ] 3.4 Remove `createWebSearchTool`, `WebSearchConfig` imports and exports from `packages/tools/src/index.ts`
- [ ] 3.5 In `packages/tools/src/agent-tools.ts`: remove `createWebSearchTool` and `createWebFetchTool` imports, remove `webSearch` and `webFetch` from `AgentToolsConfig`, remove the `if (config?.webSearch)` and `if (config?.webFetch)` blocks
- [ ] 3.6 Remove `parallel-web` from `peerDependencies` and `peerDependenciesMeta` in `packages/tools/package.json`
- [ ] 3.7 Remove `parallel-web` from `devDependencies` in `packages/tools/package.json`
- [ ] 3.8 Run `pnpm typecheck` in `packages/tools` — fix any type errors
- [ ] 3.9 Run `pnpm build` in `packages/tools` — confirm build succeeds

## 4. Verify

- [ ] 4.1 Run `pnpm test` across the workspace and confirm all tests pass
- [ ] 4.2 Confirm `packages/tools-web` appears in `pnpm list --recursive`
