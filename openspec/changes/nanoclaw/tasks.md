## Tasks

### Part 1: SessionStore Interface (packages/core)

- [ ] **Extract `SessionStore` interface in `packages/core/src/session/session-store.ts`**
  - Define interface with: `append()`, `getMessages()`, `appendCompaction()`, `branch()`, `getPathEntries()`, `getLeafId()`
  - Add `implements SessionStore` to `SessionManager` class
  - Change `AgentConfig.sessionManager` type from `SessionManager` to `SessionStore`
  - Re-export `SessionStore` from `packages/core/src/index.ts`
  - Verify existing CLI and tests compile without changes (no breaking change)
  - Fix: `Agent.autoCompact()` should call `sessionManager.appendCompaction()` to persist compaction — currently it compacts in-memory only, so compacted sessions don't survive restart

- [ ] **Write tests for `SessionStore` contract in `packages/core/src/session/session-store.test.ts`**
  - Verify `SessionManager` satisfies `SessionStore` interface
  - Test append → getMessages round-trip
  - Test appendCompaction substitutes compacted messages with summary
  - Test branch throws on unknown entryId
  - Test getPathEntries returns root-to-leaf order
  - Test getLeafId tracks latest entry
  - These tests validate the contract itself, so a future `SqliteSessionStore` can run the same assertions

### Part 2: Nanoclaw Package Scaffold

- [ ] **Create `packages/nanoclaw/` package scaffold**
  - `package.json` with dependencies: `better-sqlite3`, `grammy`, `@open-agent-sdk/{core,tools,sandbox-local,skills}`, `ai`, `dotenv`, `zod`
  - `@types/better-sqlite3` as dev dependency
  - `tsconfig.json` extending `../../tsconfig.base.json`
  - `tsup.config.ts` (same pattern as CLI: ESM, shebang, bundle workspace deps)
  - Scripts: `start` (tsx), `build` (tsup), `compile` (bun), `typecheck` (tsc)
  - Add to pnpm workspace

- [ ] **Create `packages/nanoclaw/src/config.ts`** — configuration module
  - Load env vars with defaults: `NANOCLAW_NAME`, `TELEGRAM_BOT_TOKEN`, `AI_GATEWAY_API_KEY`, `NANOCLAW_MODEL`, `NANOCLAW_POLL_INTERVAL`, `NANOCLAW_MAX_STEPS`, `NANOCLAW_DATA_DIR`
  - Export typed config object
  - Load `.env` from `~/.agents/.env` (same as CLI)

- [ ] **Create `packages/nanoclaw/src/types.ts`** — shared type definitions
  - `InboundMessage` interface (with `channel` field for DB storage and outbound routing)
  - `NanoclawConfig` type (output of config loading)

### Part 3: Message Store

- [ ] **Create `packages/nanoclaw/src/store/db.ts`** — SQLite message store
  - `initDb(dataDir)`: open `better-sqlite3` database, run `CREATE TABLE IF NOT EXISTS` for all tables (messages, chats, router_state, session_entries)
  - `storeMessage(msg)`: INSERT OR REPLACE (upsert on duplicate ID)
  - `getNewMessages(chatIds, sinceTimestamp)`: messages across groups, exclude bot messages
  - `getMessagesSince(chatId, sinceTimestamp)`: per-group messages since cursor
  - `storeChatMetadata(chatId, opts)`: upsert chat info
  - `getRouterState(key)` / `setRouterState(key, value)`: KV cursor store
  - All queries use parameterized SQL (no string interpolation)

- [ ] **Write tests for `packages/nanoclaw/src/store/db.test.ts`**
  - Reference: nanoclaw `src/db.test.ts` for feature parity
  - storeMessage upserts on duplicate ID
  - getMessagesSince filters by timestamp, excludes bot messages
  - getNewMessages returns across multiple groups
  - storeChatMetadata upserts, preserves existing name if not provided
  - Message query LIMIT caps results, returns most recent chronologically
  - Parameterized queries (no SQL injection)
  - Use in-memory SQLite (`:memory:`) for test isolation

### Part 4: SQLite Session Store

- [ ] **Create `packages/nanoclaw/src/store/session-store.ts`** — `SqliteSessionStore implements SessionStore`
  - Constructor: `(db: Database, groupId: string)` — loads entries for group, builds in-memory tree
  - `append()`: insert row + update leaf
  - `getMessages()`: tree traversal with compaction substitution (same algorithm as `SessionManager`)
  - `appendCompaction()`: insert compaction row
  - `branch()`: insert branch_summary row, throw if entryId not found
  - `getPathEntries()` / `getLeafId()`: same semantics as `SessionManager`

- [ ] **Write tests for `packages/nanoclaw/src/store/session-store.test.ts`**
  - Run the same logical test cases as the `SessionStore` contract tests from Part 1
  - Additionally test SQLite-specific behavior:
    - Entries persist across `SqliteSessionStore` instances (reload from DB)
    - Multiple groups coexist in same table without interference
    - Group isolation: group A's entries are invisible to group B

### Part 5: Channel Interface + Implementations

- [ ] **Create `packages/nanoclaw/src/channels/interface.ts`** — channel contracts
  - `Channel` interface: `name`, `connect()`, `sendMessage()`, `disconnect()`, `ownsChat?()`, `setTyping?()`
  - `ChannelFactory` type: `(opts) => Channel | null`
  - `registerChannel(name, factory)`, `getChannelFactory(name)`, `getRegisteredChannelNames()`

- [ ] **Write tests for `packages/nanoclaw/src/channels/interface.test.ts`**
  - Reference: nanoclaw `src/channels/registry.test.ts`
  - getChannelFactory returns undefined for unknown channel
  - registerChannel + getChannelFactory round-trip
  - getRegisteredChannelNames includes registered
  - Later registration overwrites earlier (last-wins)

- [ ] **Create `packages/nanoclaw/src/channels/telegram.ts`** — grammY adapter
  - Factory returns null if `TELEGRAM_BOT_TOKEN` not set
  - Maps grammY `message:text` events to `InboundMessage`
  - `sendMessage`: `bot.api.sendMessage(chatId, text)`
  - `setTyping`: `bot.api.sendChatAction(chatId, "typing")`
  - `connect`: `bot.start()` (long polling)
  - `disconnect`: `bot.stop()`

- [ ] **Create `packages/nanoclaw/src/channels/terminal.ts`** — dev mode channel
  - Uses `readline` for stdin input
  - Fixed chatId `"terminal"`, sender `"user"`
  - Prints agent responses to stdout
  - Fallback when no other channels configured

### Part 6: Message Formatting

- [ ] **Create message formatting utilities (in `packages/nanoclaw/src/format.ts`)**
  - `escapeXml(str)`: escape `&`, `<`, `>`, `"` characters
  - `formatMessages(messages, chatName)`: format as XML with timestamp conversion
  - `stripInternalTags(text)`: remove `<internal>...</internal>` blocks from agent output

- [ ] **Write tests for `packages/nanoclaw/src/format.test.ts`**
  - Reference: nanoclaw `src/formatting.test.ts`
  - escapeXml handles &, <, >, " and multiple special chars
  - formatMessages produces valid XML with sender, timestamp, content
  - Timestamps converted to local time with timezone
  - Special characters in sender names and content are escaped
  - Empty array produces empty string
  - stripInternalTags removes single-line and multi-line internal blocks

### Part 7: Message Loop + Agent Runner

- [ ] **Create `packages/nanoclaw/src/loop.ts`** — message polling and dispatch
  - `startLoop(db, channels, config)`: returns interval handle
  - Poll every `POLL_INTERVAL` ms
  - Fetch new messages, group by chatId, format XML, dispatch to runner
  - Cursor management: advance before processing, rollback on error before output
  - Find owning channel for outbound messages

- [ ] **Create `packages/nanoclaw/src/runner.ts`** — agent orchestration
  - `runGroupAgent(opts)`: async generator yielding text chunks
  - Creates `Agent` with: model, tools (`createAgentTools`), per-group sandbox, `SqliteSessionStore`, system prompt, compaction config
  - System prompt includes: assistant name, chat context, group AGENTS.md memory
  - Per-invocation lifecycle (not long-lived)
  - Sandbox factory: `createSandbox(groupDir)` — defaults to `LocalSandbox({ cwd: groupDir })`, swap for cloud sandbox

### Part 8: Daemon Entry Point

- [ ] **Create `packages/nanoclaw/src/index.ts`** — daemon main
  - Load config from env
  - Init SQLite database
  - Register and connect channels
  - Start message loop
  - Graceful shutdown on SIGINT/SIGTERM (disconnect channels, stop loop, close DB)
  - Fall back to terminal channel if no others configured
  - CLI flags: `--terminal` (force terminal mode), `--help`, `--version`

- [ ] **Integration smoke test**
  - Verify daemon starts with terminal channel (no Telegram token)
  - Send a message via terminal → agent processes → response printed
  - Verify session persists in SQLite across invocations
  - Verify graceful shutdown cleans up resources

---

### Future Layers (not in MVP scope, tracked for reference)

**Layer 2: Multi-group + concurrency**
- [ ] Group manager: registration, per-group workspaces (`./groups/{name}/`), AGENTS.md memory
- [ ] Trigger pattern matching for non-main groups (reference: nanoclaw `formatting.test.ts` trigger tests)
- [ ] Group folder path safety validation (reference: nanoclaw `group-folder.test.ts`)
- [ ] GroupQueue: per-group serialization, global concurrency limit, task priority over messages, retry with backoff (reference: nanoclaw `group-queue.test.ts`)

**Layer 3: Task scheduler**
- [ ] Cron/interval/once task scheduling (reference: nanoclaw `task-scheduler.test.ts`)
- [ ] Interval drift prevention (anchor to scheduled time, skip missed intervals)
- [ ] Agent tool for scheduling tasks
- [ ] Task CRUD in SQLite (reference: nanoclaw `db.test.ts` task tests)

**Layer 4: Security + more channels**
- [ ] Sender allowlist per group (reference: nanoclaw `sender-allowlist.test.ts`)
- [ ] IPC authorization: main vs non-main privileges (reference: nanoclaw `ipc-auth.test.ts`)
- [ ] Discord, WhatsApp, Slack channel adapters
- [ ] Mount security / path allowlists
