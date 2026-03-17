## Context

Open Agent SDK is a modular TypeScript agent framework built on the Vercel AI SDK. It currently offers:
- A `Sandbox` interface (flat: `exec`, `readFile`, `writeFile`, etc.) with three implementations (Local, E2B, Vercel)
- `runAgent()` as a stateless async generator yielding events
- Tool factories receiving a `Sandbox` + `ToolConfig`
- Basic context compaction (`compactConversation`)
- No session persistence, no in-memory sandbox, no centralized path safety

[Edge-pi](https://github.com/marcusschiesser/edge-pi) is a comparable open-source coding agent SDK that has solved several of these gaps. After comparing architectures, we identified five patterns worth adopting — each filling a distinct gap without disturbing the existing API surface.

## Goals / Non-Goals

**Goals:**
- Add `MemorySandbox` for fast, deterministic tool testing without filesystem side effects
- Add JSONL-based session persistence for conversation continuity and branching
- Add centralized workspace path resolution to prevent path traversal across all tools
- Add an `Agent` class that composes `runAgent()` with session persistence, auto-compaction, and message steering
- Upgrade `compactConversation` with token-based splitting, structured prompts, file ops tracking, and split-turn awareness

**Non-Goals:**
- Restructuring the `Sandbox` interface into namespaces (fs/exec/path) — the current flat interface is simpler and sufficient
- Adding WebContainer runtime — browser execution is out of scope for this server-focused SDK
- Replacing `runAgent()` — it remains the low-level primitive; `Agent` class is a higher-level convenience
- Adding an auth system or CLI — these are application concerns, not SDK concerns
- Adding OAuth or model factory patterns — these belong in consumer applications

## Decisions

### 1. MemorySandbox: new package vs. in-core

**Decision**: Add `MemorySandbox` as an export from a new `packages/sandbox-memory` package.

**Rationale**: Follows the existing sandbox package convention (`sandbox-local`, `sandbox-e2b`, `sandbox-vercel`). Keeps the core package lean. Users who don't need it don't pay for it.

**Alternative considered**: Adding it inside `packages/core`. Rejected because core currently has zero concrete implementations — it only defines the interface. Mixing in a concrete implementation breaks that separation.

**Reference**: Edge-pi's [`MemoryRuntime`](https://github.com/marcusschiesser/edge-pi/blob/main/packages/edge-pi/src/runtime/memory-runtime.ts)

### 2. Session persistence: JSONL tree with append-only semantics

**Decision**: Implement a `SessionManager` in `packages/core` that stores messages as JSONL entries with parent-child relationships, supporting linear replay and branching.

**Rationale**: Edge-pi's [JSONL tree session manager](https://github.com/marcusschiesser/edge-pi/blob/main/packages/edge-pi/src/session/session-manager.ts) is proven: append-only is crash-safe, parent pointers enable branching without rewriting history, and JSONL is trivially parseable. Alternatives like SQLite add a native dependency; plain JSON files require full rewrites on every append.

**Key design choices**:
- Each entry has a unique `id` and optional `parentId`
- Entry types: `message`, `compaction`, `branch-summary`
- A `leaf` pointer tracks the current conversation head
- Reading traverses from leaf to root, yielding messages in order
- Branching moves the leaf pointer to an earlier entry; a `branch-summary` captures abandoned context
- File locking via `proper-lockfile` for concurrent access safety

### 3. Workspace path resolver: centralized in core

**Decision**: Add a `resolveWorkspacePath(rootDir, requestedPath)` utility in `packages/core` that normalizes and validates paths.

**Rationale**: Currently each tool can implement its own path validation via `ToolConfig.allowedPaths`, but there's no centralized enforcement. A single resolver ensures consistent behavior: resolve relative paths against `rootDir`, reject paths that escape the root via `..`, and normalize to absolute paths. Tools call this before any filesystem operation.

**Alternative considered**: Middleware/wrapper around sandbox methods. Rejected because it would require wrapping every sandbox implementation. A utility function that tools call is simpler and doesn't change the Sandbox interface.

**Reference**: Edge-pi's [`WorkspacePathResolver`](https://github.com/marcusschiesser/edge-pi/blob/main/packages/edge-pi/src/runtime/workspace-path-resolver.ts)

### 4. Agent class: composition over inheritance

**Decision**: Add an `Agent` class in `packages/core` that wraps `runAgent()`, managing session state, auto-compaction, and message steering.

**Rationale**: Edge-pi's [`CodingAgent` class](https://github.com/marcusschiesser/edge-pi/blob/main/packages/edge-pi/src/agent.ts) demonstrates the value of encapsulating stateful concerns (session writes, compaction triggers, message injection) that are awkward to coordinate with a bare function. Our `Agent` class will:
- Accept the same options as `runAgent()` plus optional `sessionManager` and `compactionConfig`
- Expose `generate()` and `stream()` methods that auto-persist and auto-compact
- Support `steer(message)` to inject messages before the next model step
- Remain a thin layer — all actual loop logic stays in `runAgent()`

**Alternative considered**: Higher-order function wrapping `runAgent()`. Rejected because statefulness (session handle, compaction state, steered messages) is naturally expressed as a class instance.

### 5. Compaction improvements: token-based splitting with structured summaries

**Decision**: Upgrade `compactConversation` in `packages/core/src/compaction.ts` with four improvements from edge-pi's [compaction pipeline](https://github.com/marcusschiesser/edge-pi/tree/main/packages/edge-pi/src/compaction):

1. **Token-based split point** instead of fixed message count. Replace `protectRecentMessages: number` with `keepRecentTokens: number` (default 20000). Walk backwards from the newest message accumulating tokens until the budget is met, then find a valid cut point (user or assistant message boundary — never mid-tool-result).

2. **Structured summarization prompt**. Replace the free-form "Summarize the following..." with a structured template requesting: Goal, Constraints, Progress (done/in-progress/blocked), Key Decisions, Next Steps, Critical Context. Use a separate update prompt when a previous summary exists, instructing the model to preserve and extend rather than rewrite.

3. **File operations tracking**. Extract `read`/`write`/`edit` tool calls from messages being summarized, collect file paths, and append them as `<read-files>` and `<modified-files>` XML blocks to the summary. This preserves critical workspace context that free-form summaries routinely lose.

4. **Split-turn awareness**. When the cut point falls mid-turn (between a user message and its tool results), generate two parallel summaries — one for the history before the turn, one for the turn prefix — and combine them. This avoids orphaned tool results that confuse the model.

**Rationale**: Our current compaction uses `protectRecentMessages: 10`, which is a poor proxy for token budget — 10 messages could be 500 tokens or 50,000. Token-based splitting ensures consistent context retention. The structured prompt produces summaries that preserve actionable information (what was done, what's next) rather than narrative recaps.

**Alternative considered**: Keeping message-count splitting but adding the other improvements. Rejected because message-count is the root cause of the most common compaction failure mode — either too aggressive (losing recent context) or too conservative (not freeing enough space).

## Risks / Trade-offs

- **Session file locking adds a dependency** (`proper-lockfile`) → Mitigation: it's a small, well-maintained package. Make it a peer dependency so users who don't use sessions don't need it.
- **MemorySandbox may drift from real sandbox behavior** → Mitigation: test the MemorySandbox itself against the same behavioral expectations as LocalSandbox. Keep the implementation faithful to POSIX semantics for file operations.
- **Agent class could become a God object** → Mitigation: keep it thin — only orchestration (session + compaction + steering). No tool creation, no prompt assembly. Those remain separate concerns.
- **Path resolver may be too restrictive for some use cases** → Mitigation: make it opt-in at the tool level. Tools that don't need workspace restriction (e.g., AskUser) simply don't call it.
- **Structured compaction prompt may produce overly rigid summaries** → Mitigation: the template uses flexible sections with "(none)" fallbacks. The model can omit empty sections. The structured format is strictly better than free-form for downstream consumption.
- **Two parallel summarization calls on split turns doubles cost** → Mitigation: split turns are uncommon (most cut points land on turn boundaries). The turn-prefix summary uses a smaller `maxOutputTokens` budget (0.5x vs 0.8x of `reserveTokens`).
