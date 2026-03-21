## Message Store Spec

SQLite-backed message persistence using `better-sqlite3`. Single `store.db` file holds all nanoclaw state.

### Schema

**messages** — inbound/outbound messages from all channels

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Channel-specific message ID |
| chat_id | TEXT NOT NULL | Chat/group identifier |
| sender | TEXT NOT NULL | Sender identifier |
| sender_name | TEXT NOT NULL | Display name |
| content | TEXT NOT NULL | Message text |
| timestamp | TEXT NOT NULL | ISO 8601 |
| channel | TEXT NOT NULL | e.g. "telegram", "terminal" |
| is_from_me | INTEGER DEFAULT 0 | Bot's own messages |
| is_bot_message | INTEGER DEFAULT 0 | Messages from this bot |

**chats** — chat/group metadata

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Chat identifier |
| name | TEXT | Display name |
| channel | TEXT | Source channel |
| is_group | INTEGER DEFAULT 0 | Group vs DM |
| last_message_at | TEXT | For ordering |

**router_state** — key-value store for cursors and state

| Column | Type | Notes |
|---|---|---|
| key | TEXT PK | State key |
| value | TEXT NOT NULL | JSON or string value |

**session_entries** — conversation persistence (see session-store-interface spec)

### Key Behaviors (from nanoclaw db.test.ts)

- `storeMessage()` upserts on duplicate ID (INSERT OR REPLACE)
- Empty content messages are filtered on query, not on insert
- `is_from_me` flag stored and queryable
- `getMessagesSince(chatId, timestamp)` excludes bot messages via `is_bot_message` flag
- `getNewMessages(chatIds[], sinceTimestamp)` returns messages across multiple groups
- `storeChatMetadata()` upserts — updates `last_message_at` on conflict, preserves existing name if not provided
- Message queries respect a LIMIT (default cap), returning most recent chronologically
- All queries use parameterized SQL (no string interpolation — SQL injection safe)

### Indexes

- `idx_messages_chat_ts` on `(chat_id, timestamp)` — message polling performance
- `idx_session_group` on `session_entries(group_id)` — per-group session loading
