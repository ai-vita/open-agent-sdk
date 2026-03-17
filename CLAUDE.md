# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Open Agent SDK — a modular, provider-agnostic TypeScript SDK for building AI agents with any LLM via the Vercel AI SDK (v6+). Monorepo with pnpm workspaces.

## Commands

```bash
pnpm install              # install all dependencies
pnpm build                # build all packages (tsup → ESM + CJS)
pnpm test                 # run all tests (vitest)
pnpm test -- --testPathPattern=packages/core   # run tests for one package
vitest run packages/core/src/cache.test.ts     # run a single test file
pnpm typecheck            # type-check all packages
```

Run the example coding agent:
```bash
cp examples/coding-agent/.env examples/coding-agent/.env.local
# set AI_GATEWAY_API_KEY in .env.local
pnpm --filter @open-agent-sdk/example-coding-agent start "Your task"
pnpm --filter @open-agent-sdk/example-coding-agent multi-turn  # multi-turn mode
```

## Monorepo Layout

- **packages/core** — Agent loop (`runAgent()`, `Agent` class), `Sandbox` interface, tool types, caching (`cached()`, `LRUCacheStore`), compaction, session persistence, workspace path safety
- **packages/tools** — Standard tool factories: `createBashTool`, `createReadTool`, `createWriteTool`, `createEditTool`, `createGlobTool`, `createGrepTool`, `createAskUserTool`, `createTodoWriteTool`, `createTaskTool`, `createEnterPlanModeTool`, `createExitPlanModeTool`. `createAgentTools()` is the convenience factory for all of them.
- **packages/tools-web** — `WebSearch` and `WebFetch` tools (via parallel-web)
- **packages/skills** — Skill discovery from `.skills/` and `~/.agent/skills/`, SKILL.md parsing, XML injection for system prompts
- **packages/sandbox-local** — `LocalSandbox` (real filesystem + child_process shell)
- **packages/sandbox-e2b** — `E2BSandbox` (cloud sandbox, peer dep: @e2b/code-interpreter)
- **packages/sandbox-vercel** — `VercelSandbox` (Firecracker, peer dep: @vercel/sandbox)
- **packages/sandbox-memory** — `MemorySandbox` (in-memory, for testing)

## Architecture

The core abstraction is the `Sandbox` interface (exec, readFile, writeFile, readDir, fileExists, isDirectory, destroy). All tools receive a sandbox instance, making them environment-agnostic. Swap `LocalSandbox` for `E2BSandbox`/`VercelSandbox` to run the same agent in cloud sandboxes.

`runAgent()` is an async generator that yields events (AssistantMessageEvent, ToolCallEvent, ToolResultEvent, TextDeltaEvent, StepCompleteEvent, ErrorEvent, DoneEvent). Stop conditions are composable via `composeStops()` with helpers like `stepCountIs()` and `budgetExceeded()`.

Each tool creator follows the pattern: `create<Name>Tool({ sandbox, ...options })` → returns an `ai` SDK `tool()`.

## Conventions

- Vitest test files go next to their source module (e.g., `src/bash.ts` → `src/bash.test.ts`), not in a separate test directory.
- Source-first exports during development (`"exports"` points to `src/`); `publishConfig` overrides to `dist/` for npm.
- Formatting/linting: Biome (not ESLint/Prettier). Line width 100, double quotes, trailing commas, semicolons.
- All packages use `"type": "module"` (ESM). TypeScript target ES2022, module NodeNext, strict mode.
- Peer deps: `ai@>=6.0.0`, `zod@>=3.0.0`.
- Package manager: pnpm (strict peer dependencies).
