## Message Loop Spec

### Polling

The message loop polls SQLite every `POLL_INTERVAL` (default 2000ms) for new messages since the last processed timestamp.

### Flow

```
poll():
  1. messages = db.getNewMessages(lastTimestamp)  // all chats (MVP); filter by registered groups in Layer 2
  2. Advance lastTimestamp immediately (before processing)
  3. Group messages by chatId
  4. For each chatId with new messages:
     a. Fetch all pending since last_agent_timestamp for this chatId
     b. Format as XML context
     c. Dispatch to agent runner
     d. Stream text chunks back to channel (via owning channel)
     e. On success: advance per-chat cursor
     f. On error before output sent: rollback cursor for retry
     g. On error after output sent: keep cursor (prevent duplicates)
```

### Cursor Management

Two cursors stored in `router_state`:
- `last_timestamp` — global "seen" cursor, advanced before processing
- `last_agent_timestamp:{chatId}` — per-group cursor, tracks what the agent has processed

Advancing the cursor before processing prevents duplicate delivery on restart. The rollback-on-error-before-output pattern from nanoclaw ensures retry without duplication.

### XML Message Format (from nanoclaw formatting.test.ts)

```xml
<messages chat="Chat Name">
  <message sender="Alice" time="2024-01-15 10:30 AM">Hello</message>
  <message sender="Bob" time="2024-01-15 10:31 AM">Can you help?</message>
</messages>
```

Key behaviors:
- XML-escape `&`, `<`, `>`, `"` in sender names and content (XSS-safe)
- Convert timestamps to local time with timezone context in header
- Handle multiple messages per group in chronological order
- Empty message array produces no XML output

### Agent Dispatch

Each group invocation:
1. Create per-group sandbox via `createSandbox(groupDir)` (defaults to `LocalSandbox({ cwd: groupDir })`)
2. Create `SqliteSessionStore(db, groupId)` for session continuity
3. Load group AGENTS.md for system prompt memory
4. Create `Agent` with per-group sandbox, tools, system prompt, session store
5. Stream events — yield text deltas to channel as they arrive
6. On completion: session auto-persisted by Agent class

### Streaming Response

Text chunks are sent to the channel immediately as `text-delta` events arrive. For Telegram, this means calling `sendMessage` once the full response is collected (Telegram doesn't support streaming edits in the same way as a terminal).

Strategy per channel type:
- **Terminal**: print chunks as they arrive (real-time streaming)
- **Telegram**: buffer chunks, send complete message (or edit message periodically for long responses)
