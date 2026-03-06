## Context

We are building an open-source, modular TypeScript SDK for creating AI-powered coding agents. The SDK draws inspiration from two reference implementations:

1. **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): Anthropic's official SDK — powerful but opaque, vendor-locked to Claude, and monolithic in design. It handles the full agent loop internally with no way to swap components.

2. **bashkit**: An internal prototype that validates the concept of a sandbox-abstracted tool system built on the Vercel AI SDK. It has good separation of concerns (sandbox interface, tool factories, caching) but packages everything as a single module, making it impossible to use parts independently.

**Current state**: The `open-agent-sdk` repo is a fresh pnpm workspace. We are building from scratch.

**Constraints**:
- Must work with the Vercel AI SDK (`ai` v6+) as the LLM orchestration layer
- Must support TypeScript 5.x with strict mode
- Must be publishable as scoped npm packages (`@open-agent-sdk/*`)
- Must support Bun and Node.js runtimes

## Goals / Non-Goals

**Goals:**
- Modular architecture where each package has a single responsibility and can be used independently
- Clean, minimal API surface — easy to get started, powerful when you need it
- Provider-agnostic: support any LLM via the Vercel AI SDK provider ecosystem
- Sandbox-agnostic: swap between local, E2B, Vercel, or custom sandbox implementations
- First-class TypeScript: full type safety, Zod schemas for tool inputs, generic type parameters
- Composable tool system: tools are functions, not classes; easy to create, wrap, and combine
- Sub-agent support with context isolation and tool restriction
- Feature parity with bashkit: skills system, tool caching, context compaction, budget tracking, web tools

**Non-Goals:**
- Building a CLI application (that can come later as a consumer of the SDK)
- Session persistence / resumption (V1 focuses on single-session usage)
- Permission UI / interactive approval flows (consumers implement their own)
- MCP server hosting (consumers can integrate MCP tools themselves)
- Prompt engineering / system prompt libraries

## Decisions

### 1. Package Architecture

**Decision**: Eight packages in a pnpm workspace with clear dependency direction.

```
@open-agent-sdk/core               ← Interfaces, types, agent loop, caching
@open-agent-sdk/tools              ← Standard + workflow tool implementations (depends on core)
@open-agent-sdk/skills             ← Agent Skills standard support (depends on core)
@open-agent-sdk/sandbox-local      ← Local sandbox (depends on core)
@open-agent-sdk/sandbox-e2b        ← E2B sandbox (depends on core)
@open-agent-sdk/sandbox-vercel     ← Vercel Firecracker sandbox (depends on core)
@open-agent-sdk/provider-anthropic ← Anthropic middleware (depends on core)
```

**Rationale**: Each sandbox implementation is a separate package so users only install what they need. The core package contains only interfaces and the agent loop — no concrete implementations. This follows the dependency inversion principle.

**Alternatives considered**:
- *Single package with subpath exports* (`@open-agent-sdk/sdk`): Simpler to publish but forces users to install all sandbox dependencies. Rejected.
- *Monorepo with >10 packages* (one per tool): Too granular; tools are tightly related and share the sandbox interface. Rejected.

### 8. Skills System

**Decision**: A dedicated `@open-agent-sdk/skills` package handles the [Agent Skills](https://agentskills.io) standard — discovery, parsing, remote fetching, and XML formatting. Skills use progressive disclosure: only metadata at startup, full content loaded on-demand.

**Rationale**: Skills are a cross-cutting feature used by both system prompt construction and the Skill tool. Putting them in their own package keeps the tools package focused on tool execution and allows skills to be used independently (e.g., for prompt building without the full tool system).

### 9. Tool Result Caching

**Decision**: The core package provides a caching wrapper (`cached()`) and pluggable store interface (`CacheStore`). Default stores: in-memory LRU. Redis support via a separate adapter. Read-only tools (Read, Glob, Grep) are cached by default when caching is enabled.

**Rationale**: Caching is a cross-cutting concern that wraps any tool. Following bashkit's proven pattern of `cached(tool, name, options)` keeps the caching logic decoupled from tool implementations.

### 2. Sandbox Interface Design

**Decision**: A minimal interface with two concerns — command execution and filesystem operations.

```typescript
interface Sandbox {
  exec(command: string, options?: ExecOptions): Promise<ExecResult>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  readDir(path: string): Promise<DirEntry[]>
  fileExists(path: string): Promise<boolean>
  isDirectory(path: string): Promise<boolean>
  destroy(): Promise<void>
}
```

**Rationale**: This is the minimal contract that all tools need. bashkit's interface is similar and proven to work across local, Vercel, and E2B environments. By keeping it minimal, new sandbox implementations are easy to write.

**Alternatives considered**:
- *Rich interface with file watching, process management, etc.*: Over-engineered for V1. Can be added via extension interfaces later. Rejected.
- *Separate interfaces for exec and filesystem*: Possible but adds complexity for consumers who always need both. Rejected.

### 3. Tool System Design

**Decision**: Tools are factory functions that take a `Sandbox` and return Vercel AI SDK-compatible tool objects.

```typescript
function createBashTool(sandbox: Sandbox, config?: BashToolConfig): Tool
```

**Rationale**: This follows bashkit's proven pattern. Factory functions are composable (wrapping with caching, logging, etc.), testable (mock the sandbox), and compatible with the Vercel AI SDK's `tool()` function. No class hierarchies needed.

**Alternatives considered**:
- *Class-based tools with inheritance*: Heavier, harder to compose. Rejected.
- *Declarative tool definitions (JSON/YAML)*: Less flexible, can't express complex execution logic. Rejected.

### 4. Agent Loop Design

**Decision**: The core package provides a `runAgent()` function that wraps the Vercel AI SDK's `generateText`/`streamText` with agent-specific concerns (step management, budget tracking, context compaction, stop conditions).

```typescript
async function* runAgent(options: AgentOptions): AsyncGenerator<AgentEvent>
```

**Rationale**: An async generator provides real-time streaming of agent events while giving consumers full control over the iteration. This is similar to the Claude Agent SDK's `query()` pattern but built on the Vercel AI SDK instead of a proprietary runtime.

**Alternatives considered**:
- *Callback-based API*: Less composable than async generators. Rejected.
- *Direct pass-through to `streamText()`*: Doesn't add enough value; consumers still need step management. Rejected.

### 5. LLM Provider Integration

**Decision**: Use the Vercel AI SDK's `LanguageModel` type directly — no custom provider abstraction. The `@open-agent-sdk/provider-anthropic` package exports only Anthropic-specific optimizations (prompt caching middleware), not a new abstraction layer.

**Rationale**: The Vercel AI SDK already solves provider abstraction completely. Any AI SDK provider (Anthropic, OpenAI, Google, Mistral, etc.) works out of the box by passing its model to `runAgent()`. Adding our own provider interface would be redundant abstraction. This matches bashkit's approach exactly — it accepts any `LanguageModel` and only provides middleware utilities.

### 6. Build Tooling

**Decision**: Use `tsup` for package builds, `vitest` for testing, `biome` for linting/formatting.

**Rationale**: `tsup` produces clean ESM+CJS bundles with minimal config. This matches bashkit's tooling choices and the broader TypeScript ecosystem conventions.

### 7. Sub-agent System

**Decision**: Sub-agents are created by spawning a new `runAgent()` call with restricted tools and a separate message history. A `Task` tool orchestrates sub-agent lifecycle.

**Rationale**: This follows bashkit's `createTaskTool` pattern. Context isolation is achieved by giving each sub-agent its own message array, and tool restriction is achieved by filtering the tool set.

## Risks / Trade-offs

- **[Vercel AI SDK coupling]** → We depend on `ai` for the agent loop and tool types. If the AI SDK makes breaking changes, we need to update. *Mitigation*: Pin to AI SDK v6+ stable APIs; wrap AI SDK types behind our own interfaces where practical.

- **[Too many packages early on]** → Eight packages is a lot for a V1. *Mitigation*: Start with core + tools + skills + sandbox-local as the minimum viable set. E2B, Vercel, and provider-anthropic can be added incrementally.

- **[API surface discovery]** → With types split across packages, IDE auto-import may be harder. *Mitigation*: Re-export key types from the core package; provide a `@open-agent-sdk/tools` convenience package.

- **[bashkit divergence]** → We're inspired by bashkit but building from scratch. Some bashkit patterns may not translate cleanly. *Mitigation*: Cherry-pick proven patterns (sandbox interface, tool factories) rather than porting code directly.
