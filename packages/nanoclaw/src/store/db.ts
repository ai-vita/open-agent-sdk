import path from "node:path";
import Database from "better-sqlite3";
import type { InboundMessage } from "../types.js";

export type { Database };

const MESSAGE_LIMIT = 100;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,
  chat_id        TEXT NOT NULL,
  sender         TEXT NOT NULL,
  sender_name    TEXT NOT NULL,
  content        TEXT NOT NULL,
  timestamp      TEXT NOT NULL,
  channel        TEXT NOT NULL,
  is_from_me     INTEGER DEFAULT 0,
  is_bot_message INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON messages(chat_id, timestamp);

CREATE TABLE IF NOT EXISTS chats (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  channel         TEXT,
  is_group        INTEGER DEFAULT 0,
  last_message_at TEXT
);

CREATE TABLE IF NOT EXISTS router_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_entries (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL,
  parent_id  TEXT,
  type       TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_group ON session_entries(group_id);
`;

/** Open (or create) the SQLite database and initialize schema. */
export function initDb(dataDir: string): Database.Database {
  const dbPath = path.join(dataDir, "store.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

/** Open an in-memory database with the same schema (for testing). */
export function initMemoryDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  return db;
}

/** Store an inbound message (upsert on duplicate ID). */
export function storeMessage(
  db: Database.Database,
  msg: InboundMessage & { isBotMessage?: boolean },
): void {
  db.prepare(
    `INSERT OR REPLACE INTO messages (id, chat_id, sender, sender_name, content, timestamp, channel, is_from_me, is_bot_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    msg.id,
    msg.chatId,
    msg.sender,
    msg.senderName,
    msg.content,
    msg.timestamp,
    msg.channel,
    msg.isFromMe ? 1 : 0,
    msg.isBotMessage ? 1 : 0,
  );
}

/** Get messages for a chat since a timestamp, excluding bot messages. */
export function getMessagesSince(
  db: Database.Database,
  chatId: string,
  sinceTimestamp: string,
  limit = MESSAGE_LIMIT,
): InboundMessage[] {
  const rows = db
    .prepare(
      `SELECT id, chat_id, sender, sender_name, content, timestamp, channel, is_from_me
       FROM messages
       WHERE chat_id = ? AND timestamp > ? AND is_bot_message = 0
       ORDER BY timestamp ASC
       LIMIT ?`,
    )
    .all(chatId, sinceTimestamp, limit) as Array<{
    id: string;
    chat_id: string;
    sender: string;
    sender_name: string;
    content: string;
    timestamp: string;
    channel: string;
    is_from_me: number;
  }>;

  return rows.map(rowToMessage);
}

/** Get new messages across multiple chats since a timestamp, excluding bot messages. */
export function getNewMessages(
  db: Database.Database,
  chatIds: string[],
  sinceTimestamp: string,
  limit = MESSAGE_LIMIT,
): InboundMessage[] {
  if (chatIds.length === 0) {
    // All chats
    const rows = db
      .prepare(
        `SELECT id, chat_id, sender, sender_name, content, timestamp, channel, is_from_me
         FROM messages
         WHERE timestamp > ? AND is_bot_message = 0
         ORDER BY timestamp ASC
         LIMIT ?`,
      )
      .all(sinceTimestamp, limit) as Array<{
      id: string;
      chat_id: string;
      sender: string;
      sender_name: string;
      content: string;
      timestamp: string;
      channel: string;
      is_from_me: number;
    }>;
    return rows.map(rowToMessage);
  }

  const placeholders = chatIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, chat_id, sender, sender_name, content, timestamp, channel, is_from_me
       FROM messages
       WHERE chat_id IN (${placeholders}) AND timestamp > ? AND is_bot_message = 0
       ORDER BY timestamp ASC
       LIMIT ?`,
    )
    .all(...chatIds, sinceTimestamp, limit) as Array<{
    id: string;
    chat_id: string;
    sender: string;
    sender_name: string;
    content: string;
    timestamp: string;
    channel: string;
    is_from_me: number;
  }>;
  return rows.map(rowToMessage);
}

/** Upsert chat metadata. Preserves existing name if not provided. */
export function storeChatMetadata(
  db: Database.Database,
  chatId: string,
  opts: { name?: string; channel?: string; isGroup?: boolean; lastMessageAt?: string },
): void {
  const existing = db.prepare("SELECT name FROM chats WHERE id = ?").get(chatId) as
    | { name: string | null }
    | undefined;

  const name = opts.name ?? existing?.name ?? null;

  db.prepare(
    `INSERT OR REPLACE INTO chats (id, name, channel, is_group, last_message_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(chatId, name, opts.channel ?? null, opts.isGroup ? 1 : 0, opts.lastMessageAt ?? null);
}

/** Get router state value by key. */
export function getRouterState(db: Database.Database, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM router_state WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

/** Set router state value. */
export function setRouterState(db: Database.Database, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO router_state (key, value) VALUES (?, ?)").run(key, value);
}

function rowToMessage(row: {
  id: string;
  chat_id: string;
  sender: string;
  sender_name: string;
  content: string;
  timestamp: string;
  channel: string;
  is_from_me: number;
}): InboundMessage {
  return {
    id: row.id,
    chatId: row.chat_id,
    sender: row.sender,
    senderName: row.sender_name,
    content: row.content,
    timestamp: row.timestamp,
    channel: row.channel,
    isFromMe: row.is_from_me === 1,
  };
}
