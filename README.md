# Open Agent SDK

**Open-source TypeScript SDK for building AI agents** — a provider-agnostic, modular alternative to the [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/typescript.md).

Built on the [Vercel AI SDK](https://sdk.vercel.ai/) (v6+), so it works with **any LLM**: Anthropic Claude, OpenAI GPT, Google Gemini, Mistral, and more.

> **Why Open Agent SDK?** The official Claude Agent SDK is powerful but vendor-locked and opaque. Open Agent SDK gives you the same agent loop capabilities — tool use, multi-step reasoning, sub-agents, context compaction — with full control, any LLM provider, and an install-only-what-you-need package architecture.

## Features

- **Provider-agnostic** — swap between Claude, GPT-4, Gemini, or any Vercel AI SDK provider
- **Modular packages** — use only what you need; no mandatory cloud dependencies
- **Sandbox-agnostic** — run locally, on E2B, on Vercel Firecracker, or bring your own
- **Full TypeScript** — strict types, Zod schemas, generic type parameters throughout
- **Agent loop built-in** — step management, budget tracking, context compaction, stop conditions
- **Sub-agent support** — spawn isolated agents for parallel or delegated work
- **Skills system** — composable behavior modules via the [Agent Skills](https://github.com/anthropics/agent-skills) standard
- **Tool caching** — LRU cache wrapper for any tool, out of the box

## Architecture

```
open-agent-sdk/
├── packages/
│   ├── core/               # Agent loop, types, caching, utilities
│   ├── sandbox-local/      # Local filesystem + shell sandbox
│   ├── sandbox-e2b/        # E2B cloud sandbox
│   ├── sandbox-vercel/     # Vercel Firecracker sandbox
│   ├── cli/                # `oa` — standalone CLI coding agent
│   ├── tools/              # Standard agent tools (Bash, Read, Write, Edit, Glob, Grep, …)
│   ├── tools-web/          # Web tools (WebSearch, WebFetch) via parallel-web
│   └── skills/             # Agent Skills standard (discovery, parsing, XML injection)
└── examples/
    └── coding-agent/       # Complete coding agent example
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

### `oa` — Standalone CLI Agent

A terminal coding agent you can install globally and run from any directory. Session persistence, auto-compaction, streaming, skill discovery — all built in.

```bash
# Run directly from source (dev):
AI_GATEWAY_API_KEY=... pnpm --filter @open-agent-sdk/cli start

# Or build and install globally:
pnpm --filter @open-agent-sdk/cli build
npm i -g @open-agent-sdk/cli
oa                # start or resume a session
oa --new          # fresh session
oa --model openai/gpt-4o   # use a different model

# Or compile a standalone binary (requires bun):
pnpm --filter @open-agent-sdk/cli compile
./packages/cli/dist/oa     # no runtime needed
```

### Run the example coding agent

A full-featured terminal chatbot with session persistence, auto-compaction, and streaming — in ~100 lines of code.

```bash
# Copy .env and set AI_GATEWAY_API_KEY to your Vercel AI Gateway token
cp examples/coding-agent/.env examples/coding-agent/.env.local
AI_GATEWAY_API_KEY=... pnpm --filter @open-agent-sdk/example-coding-agent chatbot
# start a fresh session:
AI_GATEWAY_API_KEY=... pnpm --filter @open-agent-sdk/example-coding-agent chatbot --new
```

### Run a single-task agent

```bash
AI_GATEWAY_API_KEY=... pnpm --filter @open-agent-sdk/example-coding-agent start "Count lines of code in src/"
```

## Complete Example

```typescript
import { gateway } from "ai";
import { runAgent, stepCountIs } from "@open-agent-sdk/core";
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createAgentTools } from "@open-agent-sdk/tools";
import { discoverSkills, skillsToXml } from "@open-agent-sdk/skills";

// Works with any Vercel AI SDK provider — swap gateway() for openai(), google(), etc.
const model = gateway("anthropic/claude-sonnet-4.6");

const sandbox = new LocalSandbox({ cwd: process.cwd() });
const { tools } = createAgentTools(sandbox);

const skills = await discoverSkills();
const system = `You are an AI agent.\n\n${skillsToXml(skills)}`;

for await (const event of runAgent({
  model,
  tools,
  system,
  messages: "Summarize this codebase.",
  stopWhen: stepCountIs(10),
  stream: true,
})) {
  if (event.type === "text-delta") process.stdout.write(event.delta);
  if (event.type === "done") console.log(`\nDone in ${event.steps} steps.`);
}
```

## Packages

### `@open-agent-sdk/core`

Core interfaces and the agent loop.

- **`Sandbox`** interface — uniform API for local and cloud execution environments
- **`runAgent(options)`** — async generator that yields `AgentEvent`s as the agent acts
- **`stepCountIs(n)`**, **`budgetExceeded(fn)`**, **`composeStops(...fns)`** — stop conditions
- **`cached(tool, name, options?)`** — LRU cache wrapper for any tool
- **`compactConversation(config, state)`** — token-budget context compaction
- **`middleTruncate(text, maxLength)`** — truncate long strings for display

```typescript
import { runAgent, stepCountIs } from "@open-agent-sdk/core";

for await (const event of runAgent({ model, tools, messages: "Hello!" })) {
  if (event.type === "done") console.log(event.text);
}
```

### `@open-agent-sdk/sandbox-local`

Local sandbox that runs commands via `child_process` and accesses the real filesystem.

```typescript
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";

const sandbox = new LocalSandbox({ cwd: "/my/project" });
const result = await sandbox.exec("ls -la");
```

### `@open-agent-sdk/sandbox-e2b`

Cloud sandbox backed by [E2B](https://e2b.dev). Requires `@e2b/code-interpreter` as a peer dependency.

```typescript
import { E2BSandbox } from "@open-agent-sdk/sandbox-e2b";

const sandbox = new E2BSandbox({ apiKey: process.env.E2B_API_KEY });
```

### `@open-agent-sdk/sandbox-vercel`

Cloud sandbox backed by [Vercel Firecracker](https://vercel.com/docs/sandbox). Requires `@vercel/sandbox` as a peer dependency.

```typescript
import { VercelSandbox } from "@open-agent-sdk/sandbox-vercel";

const sandbox = new VercelSandbox({ runtime: "node22" });
```

### `@open-agent-sdk/tools`

Standard agent tools built on the Sandbox interface.

| Tool | Description |
|------|-------------|
| `createBashTool(sandbox)` | Run shell commands with timeout and output truncation |
| `createReadTool(sandbox)` | Read files with line numbers, offset/limit pagination |
| `createWriteTool(sandbox)` | Write files with parent directory creation |
| `createEditTool(sandbox)` | Targeted string replacement in files |
| `createGlobTool(sandbox)` | Glob pattern file search |
| `createGrepTool(sandbox)` | Regex content search (with ripgrep when available) |
| `createAskUserTool()` | Pause agent to ask the user a question |
| `createEnterPlanModeTool(state)` | Enter planning mode |
| `createExitPlanModeTool(state)` | Exit planning mode with a plan |
| `createTodoWriteTool(state)` | Track task progress |
| `createTaskTool(config)` | Spawn sub-agents for parallel/isolated work |

The **`createAgentTools(sandbox, config?)`** convenience factory creates all tools in one call:

```typescript
import { createAgentTools } from "@open-agent-sdk/tools";

const { tools, planModeState, todoState } = createAgentTools(sandbox, {
  tools: { Bash: { timeout: 30_000 } },
});
```

### `@open-agent-sdk/tools-web`

Web tools backed by `parallel-web`. Install this package when you need WebSearch or WebFetch.

```typescript
import { createWebSearchTool, createWebFetchTool } from "@open-agent-sdk/tools-web";

const webSearch = createWebSearchTool();
const webFetch = createWebFetchTool();
```

### `@open-agent-sdk/cli`

Standalone CLI coding agent — `oa`. Install globally or compile to a standalone binary.

```bash
npm i -g @open-agent-sdk/cli
oa              # interactive agent in current directory
oa --new        # fresh session
oa --help       # show all options
```

Features: session persistence (`.session.jsonl`), auto-compaction, skill discovery, configurable model via `--model`.

### `@open-agent-sdk/skills`

[Agent Skills](https://github.com/anthropics/agent-skills) standard — composable behavior modules loaded from `SKILL.md` files.

```typescript
import { discoverSkills, skillsToXml, setupAgentEnvironment } from "@open-agent-sdk/skills";

// Discover skills from .skills/ and ~/.agents/skills/
const skills = await discoverSkills();

// Inject into system prompt as XML
const systemPrompt = `You are an AI agent.\n\n${skillsToXml(skills)}`;

// Or set up a sandbox workspace with skill files
await setupAgentEnvironment(sandbox, { skills });
```

## Open Agent SDK vs Claude Agent SDK

| | Open Agent SDK | Claude Agent SDK |
|---|---|---|
| **LLM providers** | Any (OpenAI, Anthropic, Google, Mistral, …) | Anthropic only |
| **Open source** | Yes (MIT) | No |
| **Package architecture** | Modular — install only what you need | Monolithic |
| **Sandbox** | Local, E2B, Vercel, or custom | Managed (opaque) |
| **Agent loop** | Transparent, extensible | Internal, black-box |
| **Built on** | Vercel AI SDK (standard) | Proprietary runtime |

## Development

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests (105 tests across 8 packages)
pnpm -r typecheck   # Type-check all packages
```

## License

MIT
