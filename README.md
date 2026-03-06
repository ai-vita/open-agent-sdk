# open-agent-sdk

A modular TypeScript SDK for building AI coding agents, built on the [Vercel AI SDK](https://sdk.vercel.ai/) (v6+).

## Architecture

```
open-agent-sdk/
├── packages/
│   ├── core/               # Agent loop, types, caching, utilities
│   ├── sandbox-local/      # Local filesystem + shell sandbox
│   ├── sandbox-e2b/        # E2B cloud sandbox
│   ├── sandbox-vercel/     # Vercel Firecracker sandbox
│   ├── tools/              # Standard coding tools (Bash, Read, Write, Edit, Glob, Grep, …)
│   ├── skills/             # Agent Skills standard (discovery, parsing, XML injection)
│   └── provider-anthropic/ # Anthropic prompt-caching middleware
└── examples/
    └── coding-agent/       # Complete coding agent example
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

### Run the example agent

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @open-agent-sdk/example-coding-agent start
# or pass a custom task:
ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @open-agent-sdk/example-coding-agent start "Count lines of code in src/"
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
import { createLocalSandbox } from "@open-agent-sdk/sandbox-local";

const sandbox = createLocalSandbox({ cwd: "/my/project" });
const result = await sandbox.exec("ls -la");
```

### `@open-agent-sdk/sandbox-e2b`

Cloud sandbox backed by [E2B](https://e2b.dev). Requires `@e2b/code-interpreter` as a peer dependency.

```typescript
import { createE2BSandbox } from "@open-agent-sdk/sandbox-e2b";

const sandbox = await createE2BSandbox({ apiKey: process.env.E2B_API_KEY });
```

### `@open-agent-sdk/sandbox-vercel`

Cloud sandbox backed by [Vercel Firecracker](https://vercel.com/docs/sandbox). Requires `@vercel/sandbox` as a peer dependency.

```typescript
import { createVercelSandbox } from "@open-agent-sdk/sandbox-vercel";

const sandbox = await createVercelSandbox({ runtime: "node22" });
```

### `@open-agent-sdk/tools`

Standard coding tools built on the Sandbox interface.

| Factory | Description |
|---------|-------------|
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
| `createWebSearchTool(config)` | Web search via `parallel-web` (optional) |
| `createWebFetchTool(config)` | URL fetching and AI processing via `parallel-web` (optional) |
| `createTaskTool(config)` | Spawn sub-agents for parallel/isolated work |

The **`createAgentTools(sandbox, config?)`** convenience factory creates all tools in one call:

```typescript
import { createAgentTools } from "@open-agent-sdk/tools";

const { tools, planModeState, todoState } = createAgentTools(sandbox, {
  bash: { timeout: 30_000 },
  read: { maxLines: 500 },
  write: true,
  edit: true,
  glob: true,
  grep: true,
});
```

### `@open-agent-sdk/skills`

[Agent Skills](https://github.com/anthropics/agent-skills) standard — composable behavior modules loaded from `SKILL.md` files.

```typescript
import { discoverSkills, skillsToXml, setupAgentEnvironment } from "@open-agent-sdk/skills";

// Discover skills from ~/.claude/skills/
const skills = await discoverSkills();

// Inject into system prompt as XML
const systemPrompt = `You are a coding agent.\n\n${skillsToXml(skills)}`;

// Or set up a sandbox workspace with skill files
await setupAgentEnvironment(sandbox, { skills });
```

### `@open-agent-sdk/provider-anthropic`

Anthropic-specific middleware for the AI SDK.

**Prompt caching** — automatically adds `cache_control` markers to reduce costs on repeated agent runs:

```typescript
import { wrapLanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { anthropicPromptCacheMiddleware } from "@open-agent-sdk/provider-anthropic";

const model = wrapLanguageModel({
  model: createAnthropic()("claude-sonnet-4-5"),
  middleware: anthropicPromptCacheMiddleware,
});
```

## Complete Example

```typescript
import { createAnthropic } from "@ai-sdk/anthropic";
import { wrapLanguageModel } from "ai";
import { runAgent, stepCountIs } from "@open-agent-sdk/core";
import { createLocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createAgentTools } from "@open-agent-sdk/tools";
import { discoverSkills, skillsToXml } from "@open-agent-sdk/skills";
import { anthropicPromptCacheMiddleware } from "@open-agent-sdk/provider-anthropic";

const model = wrapLanguageModel({
  model: createAnthropic()("claude-sonnet-4-5"),
  middleware: anthropicPromptCacheMiddleware,
});

const sandbox = createLocalSandbox({ cwd: process.cwd() });
const { tools } = createAgentTools(sandbox);

const skills = await discoverSkills();
const system = `You are a coding agent.\n\n${skillsToXml(skills)}`;

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

## Development

```bash
pnpm build          # Build all packages
pnpm test           # Run all tests (105 tests across 8 packages)
pnpm -r typecheck   # Type-check all packages
```

## License

MIT
