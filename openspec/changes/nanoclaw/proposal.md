## Why

We want a multi-channel AI assistant daemon — an agent that lives in the background, receives messages from Telegram (and later Discord, WhatsApp, etc.), and responds using the full power of our SDK's tool suite. This is inspired by [NanoClaw](https://github.com/qwibitai/nanoclaw), a similar project built on the Claude Agent SDK (~33 source files, container-isolated agents, multi-channel routing).

NanoClaw's core ideas are good — channel abstraction, SQLite message store, per-group sessions, scheduled tasks, trigger-based activation — but its architecture is tightly coupled to Docker containers and Anthropic's proprietary SDK. By porting these ideas to our SDK, we get:

- **Sandbox-agnostic execution** — `LocalSandbox` for dev, `E2BSandbox`/`VercelSandbox` for cloud, no container plumbing needed
- **Provider-agnostic models** — any Vercel AI SDK provider, not just Anthropic
- **Dramatically simpler architecture** — no container runner, no IPC files, no credential proxy (~800 lines of plumbing eliminated)

## What Changes

### 1. Extract `SessionStore` interface in `packages/core`

The `Agent` class currently depends on the concrete `SessionManager` (JSONL-backed). Extract an interface so that alternative backends (SQLite for nanoclaw) can be used:

```
packages/core/src/session/
  session-store.ts      # NEW: SessionStore interface
  session-manager.ts    # SessionManager implements SessionStore (no behavior change)
```

`AgentConfig.sessionManager` type widens from `SessionManager` to `SessionStore`. Zero breaking changes — existing code passes a `SessionManager` which satisfies the interface.

### 2. Create `packages/nanoclaw` — multi-channel AI assistant

A new package `@open-agent-sdk/nanoclaw` that runs as a background daemon:

```
Telegram ──→ SQLite ──→ Message Loop ──→ Agent (any Sandbox)
    ◄──────────────────────────────── Stream text back
```

**MVP scope (Layer 1):** Single-group Telegram bot + terminal dev mode
- Channel interface + Telegram (grammY) + terminal adapters
- SQLite message store (better-sqlite3) — messages, chats, router state, sessions
- Message loop: poll DB every 2s → format XML context → dispatch to Agent
- Agent runner: wraps our `Agent` class with per-group sandbox, tools, session, compaction
- One persistent session per group (like nanoclaw), cross-session memory via AGENTS.md
- Config via environment variables

**Iteration path:**
- Layer 2: Multi-group support, trigger patterns, GroupQueue concurrency control
- Layer 3: Task scheduler (cron/interval/once), agent scheduling tools
- Layer 4: More channels (Discord, WhatsApp, Slack), mount security, sender allowlists

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Telegram library | `grammy` | TS-native, actively maintained, 25KB, nanoclaw's choice |
| SQLite library | `better-sqlite3` | Mature, no API churn, works across runtimes |
| ORM | None (typed raw SQL) | 5-table schema, simple CRUD — drizzle is overhead at this scale |
| Session storage | SQLite (not .jsonl) | Consistent with all other data; one DB, one backup |
| Sandbox | One per group (tenant isolation) | Soft with LocalSandbox; true with cloud sandboxes |
| Group workspace | `./groups/{name}/` | Follows nanoclaw convention, trivial to change |
| Session model | One per group, persistent | Like nanoclaw; compaction keeps context manageable |
| Memory | `groups/AGENTS.md` (global) + per-group | Cross-session memory without multi-session complexity |
| Agent lifecycle | Per-invocation | Stateless, simple; SessionStore handles continuity |
| Message format | XML (like nanoclaw) | Clean, works well with LLMs |

## Non-Goals (MVP)

- Container isolation (use cloud sandboxes instead)
- IPC file protocol (agents run in-process)
- Credential proxy (model auth handled by Vercel AI SDK)
- Web UI or API server
- Multi-model routing per group

## Scope

- ~80 lines changed in `packages/core` (extract interface, widen type, fix autoCompact persistence)
- ~800 lines new in `packages/nanoclaw` (9 source files + tests)
- Zero breaking changes to existing packages
