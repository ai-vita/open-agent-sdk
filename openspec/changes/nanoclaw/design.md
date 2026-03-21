## Design

### Part 1: SessionStore Interface (packages/core)

Extract a `SessionStore` interface from the concrete `SessionManager` class. The interface captures exactly what the `Agent` class needs:

```typescript
// packages/core/src/session/session-store.ts
interface SessionStore {
  append(message: ModelMessage): string;
  getMessages(): ModelMessage[];
  appendCompaction(summary: string, compactedEntryIds: string[]): string;
  branch(entryId: string, reason: string): string;
  getPathEntries(): SessionEntry[];
  getLeafId(): string | null;
}
```

Changes:
- `SessionManager` adds `implements SessionStore` (no behavior change)
- `AgentConfig.sessionManager` type changes from `SessionManager` to `SessionStore`
- Re-export `SessionStore` from `packages/core/src/index.ts`

### Part 2: Nanoclaw Package Architecture

```
packages/nanoclaw/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts                 daemon entry point
    ├── config.ts                env vars, paths, defaults
    ├── types.ts                 shared interfaces
    ├── store/
    │   ├── db.ts                SQLite schema + typed queries
    │   └── session-store.ts     SqliteSessionStore implements SessionStore
    ├── channels/
    │   ├── interface.ts         Channel + ChannelFactory contracts
    │   ├── telegram.ts          grammY adapter
    │   └── terminal.ts          stdin/stdout dev mode
    ├── loop.ts                  message polling + dispatch
    └── runner.ts                Agent wrapper
```

### Channel Interface

```typescript
interface InboundMessage {
  id: string;
  chatId: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: string;
  channel: string;        // e.g. "telegram", "terminal"
  isFromMe?: boolean;
}

interface Channel {
  readonly name: string;
  connect(): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
  ownsChat?(chatId: string): boolean;  // optional; daemon also tracks via inbound messages
  setTyping?(chatId: string, isTyping: boolean): Promise<void>;
}

// Returns null if credentials not configured (skip silently)
type ChannelFactory = (opts: {
  onMessage: (msg: InboundMessage) => void;
}) => Channel | null;
```

The daemon iterates over registered factories at startup. Unconfigured channels return `null` and are skipped — no bloat from unused integrations.

### SQLite Schema

```sql
CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  chat_id    TEXT NOT NULL,
  sender     TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content    TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  channel    TEXT NOT NULL,
  is_from_me INTEGER DEFAULT 0,
  is_bot_message INTEGER DEFAULT 0
);
CREATE INDEX idx_messages_chat_ts ON messages(chat_id, timestamp);

CREATE TABLE chats (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  channel         TEXT,
  is_group        INTEGER DEFAULT 0,
  last_message_at TEXT
);

CREATE TABLE router_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE session_entries (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL,
  parent_id  TEXT,
  type       TEXT NOT NULL,   -- 'message' | 'compaction' | 'branch_summary'
  data       TEXT NOT NULL,   -- JSON payload
  created_at TEXT NOT NULL
);
CREATE INDEX idx_session_group ON session_entries(group_id);
```

### SqliteSessionStore

Implements `SessionStore` backed by the `session_entries` table. Same tree-traversal logic as `SessionManager` (leaf-to-root path, compaction substitution), but reads/writes go to SQLite instead of a `.jsonl` file.

Constructor takes `(db: Database, groupId: string)` — each group gets its own session namespace within the same table.

On construction, loads entries for the group and builds the in-memory `byId` map + `leafId`. The `append()`, `appendCompaction()`, and `branch()` methods insert rows and update in-memory state, same as the JSONL version.

### Message Loop

```
poll() — runs every POLL_INTERVAL (2000ms)
  1. getNewMessages(since: lastTimestamp)
  2. Advance lastTimestamp immediately
  3. Group messages by chatId
  4. For each group with new messages:
     a. Format as XML context
     b. Run agent (runner.ts)
     c. Stream text back to channel
     d. On error before output: rollback cursor
     e. On error after output: keep cursor (prevent duplicates)
```

### XML Message Format

```xml
<messages chat="Family Chat">
  <message sender="Alice" time="2024-01-15 10:30">Hello</message>
  <message sender="Bob" time="2024-01-15 10:31">Can you help?</message>
</messages>
```

### Sandbox Model

**One sandbox per group (tenant isolation).** Each group is a tenant — different users, different conversations, different memory. The sandbox boundary prevents info leaks between groups.

```
Daemon startup:
  For each group:
    sandbox = createSandbox({ cwd: groups/{name}/ })

Group "Family" → Sandbox(cwd: groups/family/)   ← can only see family/
Group "Work"   → Sandbox(cwd: groups/work/)     ← can only see work/
```

With `LocalSandbox`, this is **soft isolation** — construction is free (no process spawn), but bash can technically escape the cwd. With `E2BSandbox` or `VercelSandbox`, this becomes **true isolation** automatically. The per-group sandbox API is correct regardless of backend, so swapping sandbox provider = instant real isolation.

The daemon accepts a `createSandbox: (groupDir: string) => Sandbox` factory, defaulting to `(dir) => new LocalSandbox({ cwd: dir })`. This keeps the sandbox choice vendor-agnostic.

### Session & Memory Model

**One persistent session per group** (like nanoclaw). No multi-session picker — each group has one continuous conversation, with compaction keeping context manageable.

**Cross-session memory** via AGENTS.md files (three-tier hierarchy from nanoclaw):

| Level | Location | Access | Purpose |
|-------|----------|--------|---------|
| Global | `groups/AGENTS.md` | All groups read, main writes | Shared preferences, facts |
| Group | `groups/{name}/AGENTS.md` | That group read/write | Group-specific context |
| Files | `groups/{name}/*.md` | That group read/write | Notes, research |

The agent's system prompt includes the group's AGENTS.md content, giving it persistent memory across invocations without needing multiple sessions.

### Agent Runner

Creates an `Agent` instance per invocation (not long-lived). Each group gets its own sandbox and session store:

```typescript
async function* runGroupAgent(opts: {
  prompt: string;
  groupId: string;
  sandbox: Sandbox;       // per-group sandbox (cwd: groups/{name}/)
  model: LanguageModel;
  db: Database;
}): AsyncGenerator<string> {
  const sessionStore = new SqliteSessionStore(opts.db, opts.groupId);
  const tools = createAgentTools({ sandbox: opts.sandbox });
  const memory = await loadGroupMemory(opts.sandbox);  // AGENTS.md content

  const agent = new Agent({
    model: opts.model,
    tools,
    system: buildSystemPrompt(opts.groupId, memory),
    sessionManager: sessionStore,
    maxSteps: 20,
    compaction: {
      maxTokens: 200_000,
      keepRecentTokens: 20_000,
      reserveTokens: 16_384,
    },
  });

  for await (const event of agent.stream(opts.prompt)) {
    if (event.type === "text-delta") {
      yield event.textDelta;
    }
  }
}
```

Per-invocation is simpler than keeping agents alive — `SqliteSessionStore` handles continuity across invocations. Sandbox is per-group for tenant isolation.

### Telegram Channel (grammY)

```typescript
function createTelegramChannel(opts: { onMessage }): Channel | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;  // skip if not configured

  const bot = new Bot(token);

  bot.on("message:text", (ctx) => {
    opts.onMessage({
      id: String(ctx.message.message_id),
      chatId: String(ctx.chat.id),
      sender: String(ctx.from.id),
      senderName: ctx.from.first_name,
      content: ctx.message.text,
      timestamp: new Date(ctx.message.date * 1000).toISOString(),
      channel: "telegram",
    });
  });

  return {
    name: "telegram",
    connect: () => bot.start(),
    sendMessage: (chatId, text) => bot.api.sendMessage(chatId, text),
    disconnect: () => bot.stop(),
    setTyping: (chatId) => bot.api.sendChatAction(chatId, "typing"),
  };
}
```

### Terminal Channel (Dev Mode)

Uses `readline` for stdin input. Simulates a single "main" chat. Activated when no other channels are configured, or via `--terminal` flag.

### Configuration

All via environment variables with sensible defaults:

```
NANOCLAW_NAME=Andy              # assistant name
TELEGRAM_BOT_TOKEN=             # enables Telegram channel
AI_GATEWAY_API_KEY=             # model API key
NANOCLAW_MODEL=anthropic/claude-sonnet-4-6
NANOCLAW_POLL_INTERVAL=2000     # ms
NANOCLAW_MAX_STEPS=20
NANOCLAW_DATA_DIR=./data        # SQLite DB + groups
```

### Daemon Lifecycle

```
main():
  1. loadConfig()           — env vars → config object (includes createSandbox factory)
  2. initDb(config)         — open SQLite, run CREATE TABLE IF NOT EXISTS
  3. connectChannels()      — iterate factories, connect non-null channels
  4. startLoop(db, channels, config)  — setInterval(poll, POLL_INTERVAL)
                                        loop creates per-group sandbox on each dispatch
  5. registerShutdown()     — SIGINT/SIGTERM → disconnect channels, close DB

  If zero channels connected → fall back to terminal mode
```

### Package Dependencies

```json
{
  "dependencies": {
    "@open-agent-sdk/core": "workspace:*",
    "@open-agent-sdk/sandbox-local": "workspace:*",
    "@open-agent-sdk/tools": "workspace:*",
    "@open-agent-sdk/skills": "workspace:*",
    "ai": "^6.0.0",
    "better-sqlite3": "^11.0.0",
    "dotenv": "^16.0.0",
    "grammy": "^1.0.0",
    "zod": "^3.0.0"
  }
}
```

### Build & Run

```bash
# Development
pnpm --filter @open-agent-sdk/nanoclaw start

# Build
pnpm --filter @open-agent-sdk/nanoclaw build

# Binary (optional, via bun)
pnpm --filter @open-agent-sdk/nanoclaw compile
```

Entry point: `src/index.ts` with shebang `#!/usr/bin/env node`.
