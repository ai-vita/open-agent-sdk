## 1. Workspace & Build Setup

- [ ] 1.1 Configure pnpm workspace with package directories for all packages (`packages/*`)
- [ ] 1.2 Create shared tsconfig base with strict mode, ESM output, and path aliases
- [ ] 1.3 Set up `tsup` build configuration for all packages (ESM + CJS dual output, .d.ts generation)
- [ ] 1.4 Set up `vitest` as the test runner with workspace-level config
- [ ] 1.5 Set up `biome` for linting and formatting with shared config

## 2. Core Package (`@open-agent-sdk/core`)

- [ ] 2.1 Scaffold `packages/core` with package.json, tsconfig, and tsup config
- [ ] 2.2 Define the `Sandbox` interface (`exec`, `readFile`, `writeFile`, `readDir`, `fileExists`, `isDirectory`, `destroy`) and related types (`ExecOptions`, `ExecResult`, `DirEntry`)
- [ ] 2.3 Define tool-related types (`ToolConfig`, `ToolSet`, tool result union types) compatible with the Vercel AI SDK
- [ ] 2.4 Define agent event types (`AgentEvent` discriminated union: `assistant-message`, `tool-call`, `tool-result`, `text-delta`, `step-complete`, `error`, `done`)
- [ ] 2.5 Define `AgentOptions` interface (model, tools, system prompt, messages, stopWhen, stream, maxSteps, onStepFinish)
- [ ] 2.6 Implement `runAgent()` async generator — core loop using Vercel AI SDK `generateText`/`streamText` with step management
- [ ] 2.7 Implement stop condition helpers (`stepCountIs`, `budgetExceeded`, `composeStops`)
- [ ] 2.8 Implement context compaction utility (token estimation, message summarization, threshold-based triggering)
- [ ] 2.9 Implement `CacheStore` interface, `LRUCacheStore`, and `cached()` tool wrapper
- [ ] 2.10 Implement `middleTruncate` and other shared utility functions
- [ ] 2.11 Write unit tests for core types, agent loop, stop conditions, compaction, and caching

## 3. Local Sandbox Package (`@open-agent-sdk/sandbox-local`)

- [ ] 3.1 Scaffold `packages/sandbox-local` with package.json depending on `@open-agent-sdk/core`
- [ ] 3.2 Implement `createLocalSandbox(options?)` factory using native `child_process` / Bun `spawn`
- [ ] 3.3 Implement filesystem operations (`readFile`, `writeFile`, `readDir`, `fileExists`, `isDirectory`) using Node.js `fs` APIs
- [ ] 3.4 Implement command timeout and process cleanup logic
- [ ] 3.5 Write integration tests for local sandbox (exec, filesystem ops, timeout)

## 4. Standard Tools Package (`@open-agent-sdk/tools`)

- [ ] 4.1 Scaffold `packages/tools` with package.json depending on `@open-agent-sdk/core`
- [ ] 4.2 Implement `createBashTool(sandbox, config?)` — command execution with output truncation and timeout
- [ ] 4.3 Implement `createReadTool(sandbox, config?)` — file reading with line numbers, offset/limit support
- [ ] 4.4 Implement `createWriteTool(sandbox, config?)` — file creation/overwrite with parent directory creation
- [ ] 4.5 Implement `createEditTool(sandbox, config?)` — targeted string replacement in files
- [ ] 4.6 Implement `createGlobTool(sandbox, config?)` — glob pattern file search
- [ ] 4.7 Implement `createGrepTool(sandbox, config?)` — regex content search (with ripgrep support when available)
- [ ] 4.8 Implement `createAskUserTool(config?)` — interactive user clarification with question/options
- [ ] 4.9 Implement `createEnterPlanModeTool(state)` and `createExitPlanModeTool(state)` — planning workflow
- [ ] 4.10 Implement `createTodoWriteTool(state, config?)` — task progress tracking
- [ ] 4.11 Implement `createAgentTools(sandbox, config?)` convenience factory that creates all tools with cache support
- [ ] 4.12 Write unit tests for each tool (mock sandbox, verify inputs/outputs, error handling)

## 5. Skills Package (`@open-agent-sdk/skills`)

- [ ] 5.1 Scaffold `packages/skills` with package.json depending on `@open-agent-sdk/core`
- [ ] 5.2 Define `SkillMetadata`, `SkillBundle`, and related types
- [ ] 5.3 Implement `parseSkillMetadata(content, path)` — YAML frontmatter parsing from SKILL.md
- [ ] 5.4 Implement `discoverSkills(options?)` — filesystem scanning for SKILL.md files with progressive disclosure
- [ ] 5.5 Implement `fetchSkill(ref)` and `fetchSkills(refs)` — download skill folders from GitHub
- [ ] 5.6 Implement `skillsToXml(skills)` — XML formatting for system prompt injection
- [ ] 5.7 Implement `setupAgentEnvironment(sandbox, config)` — workspace directory creation and skill seeding
- [ ] 5.8 Implement `createSkillTool(skills)` — tool for on-demand skill activation
- [ ] 5.9 Write tests for parsing, discovery, fetching, XML generation, and environment setup

## 6. Sub-agent System

- [ ] 6.1 Implement `createTaskTool(options)` in the tools package — sub-agent spawning with context isolation
- [ ] 6.2 Implement sub-agent type configuration (predefined types with system prompt and tool restriction)
- [ ] 6.3 Implement dynamic sub-agent creation (inline system prompt and tool list)
- [ ] 6.4 Implement sub-agent streaming to UI via `streamWriter` support
- [ ] 6.5 Write tests for sub-agent spawning, tool restriction, and result propagation

## 7. Anthropic Provider Package (`@open-agent-sdk/provider-anthropic`)

- [ ] 7.1 Scaffold `packages/provider-anthropic` with package.json depending on `@open-agent-sdk/core` and `@ai-sdk/anthropic`
- [ ] 7.2 Implement Anthropic prompt caching middleware (compatible with `wrapLanguageModel`, AI SDK v6+)
- [ ] 7.3 Write tests for the caching middleware (verify cache control markers are added correctly)

## 8. E2B Sandbox Package (`@open-agent-sdk/sandbox-e2b`)

- [ ] 8.1 Scaffold `packages/sandbox-e2b` with package.json depending on `@open-agent-sdk/core` and `@e2b/code-interpreter`
- [ ] 8.2 Implement `createE2BSandbox(options)` factory with lazy initialization
- [ ] 8.3 Implement all Sandbox interface methods using E2B API calls
- [ ] 8.4 Implement lifecycle management (lazy provisioning, destroy cleanup, reconnection via sandboxId)
- [ ] 8.5 Write tests (unit tests with mocked E2B client)

## 9. Vercel Sandbox Package (`@open-agent-sdk/sandbox-vercel`)

- [ ] 9.1 Scaffold `packages/sandbox-vercel` with package.json depending on `@open-agent-sdk/core` and `@vercel/sandbox`
- [ ] 9.2 Implement `createVercelSandbox(options?)` factory with lazy singleton pattern
- [ ] 9.3 Implement all Sandbox interface methods using Vercel sandbox API
- [ ] 9.4 Implement ripgrep auto-provisioning (`ensureSandboxTools`) and reconnection via `sandboxId`
- [ ] 9.5 Write tests (unit tests with mocked Vercel client)

## 10. Integration & Documentation

- [ ] 10.1 Create a basic example app demonstrating core + sandbox-local + tools + skills + provider-anthropic
- [ ] 10.2 Verify all packages build cleanly and exports are correct
- [ ] 10.3 Run full test suite across all packages
- [ ] 10.4 Write root README with architecture overview, quick start, and package descriptions
