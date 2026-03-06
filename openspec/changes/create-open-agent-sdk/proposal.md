## Why

The Anthropic Claude Agent SDK provides a powerful but opaque, vendor-locked agent runtime. Developers building AI-powered coding agents need an open-source, modular alternative that gives them full control over the agent loop, tool system, sandbox execution, and LLM provider — without being locked to a single vendor or monolithic architecture. An existing prototype ([bashkit](https://github.com/jbreite/bashkit)) validates the concept and feature set but couples all concerns into a single package, making it hard to swap components or extend cleanly. Our goal is to achieve feature parity with bashkit while delivering a cleaner, more elegant multi-package architecture.

## What Changes

- Create a new multi-package TypeScript SDK (`open-agent-sdk`) built from scratch with a modular, pnpm-workspace architecture
- Introduce a **core package** (`@open-agent-sdk/core`) containing the agent loop, tool interfaces, sandbox abstraction, message types, and conversation management
- Provide **sandbox implementation packages** (e.g., `@open-agent-sdk/sandbox-local`, `@open-agent-sdk/sandbox-e2b`, `@open-agent-sdk/sandbox-vercel`) as separate packages implementing the core sandbox interface
- Provide a **tools package** (`@open-agent-sdk/tools`) with standard coding tools (Bash, Read, Write, Edit, Glob, Grep) and workflow tools (Task, TodoWrite, AskUser, PlanMode) built on the sandbox interface
- Provide a **skills package** (`@open-agent-sdk/skills`) for the [Agent Skills](https://agentskills.io) standard — discovery, parsing, fetching from GitHub, and XML injection into system prompts
- Provide a **provider package** (`@open-agent-sdk/provider-anthropic`) for Anthropic/Claude integration, with the architecture supporting additional providers
- Support for the **Vercel AI SDK** (`ai`) as the underlying LLM orchestration layer, maintaining compatibility with its tool and streaming abstractions

## Capabilities

### New Capabilities
- `agent-loop`: Core agent conversation loop — message management, step execution, stop conditions, context compaction, and budget tracking
- `tool-system`: Tool definition interface, tool registration, tool execution pipeline, and tool result handling
- `sandbox-interface`: Abstract sandbox contract for command execution and filesystem operations; implementations are separate packages
- `sandbox-local`: Local machine sandbox implementation using native process spawning
- `sandbox-e2b`: E2B cloud sandbox implementation
- `sandbox-vercel`: Vercel Firecracker microVM sandbox implementation
- `standard-tools`: Standard coding tools (Bash, Read, Write, Edit, Glob, Grep) and workflow tools (AskUser, PlanMode, TodoWrite) built on sandbox interface
- `skills-system`: Agent Skills standard support — discovery from filesystem, SKILL.md parsing, remote fetching from GitHub, XML formatting for system prompts, and environment setup
- `caching`: Tool result caching with pluggable stores (LRU, Redis) and per-tool configuration
- `subagent-system`: Sub-agent spawning via Task tool, context isolation, tool restriction, and streaming to UI

### Modified Capabilities

(none — this is a greenfield project)

## Impact

- **New packages**: 8-10 new npm packages under the `@open-agent-sdk` scope
- **Dependencies**: `ai` (Vercel AI SDK), `zod` for schema validation, provider-specific SDKs in their respective packages
- **Build system**: pnpm workspace with `tsup` or `unbuild` for package builds
- **Ecosystem**: Provides an open-source, vendor-neutral alternative to `@anthropic-ai/claude-agent-sdk`
