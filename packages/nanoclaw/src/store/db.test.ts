import { describe, expect, it } from "vitest";
import type { InboundMessage } from "../types.js";
import {
  getMessagesSince,
  getNewMessages,
  getRouterState,
  initMemoryDb,
  setRouterState,
  storeChatMetadata,
  storeMessage,
} from "./db.js";

function makeMsg(
  overrides: Partial<InboundMessage> & { isBotMessage?: boolean } = {},
): InboundMessage & { isBotMessage?: boolean } {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    chatId: "chat-1",
    sender: "user-1",
    senderName: "Alice",
    content: "hello",
    timestamp: new Date().toISOString(),
    channel: "telegram",
    ...overrides,
  };
}

describe("message store", () => {
  it("storeMessage upserts on duplicate ID", () => {
    const db = initMemoryDb();
    const msg = makeMsg({ id: "dup-1", content: "original" });
    storeMessage(db, msg);
    storeMessage(db, { ...msg, content: "updated" });

    const rows = getMessagesSince(db, "chat-1", "1970-01-01T00:00:00.000Z");
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("updated");
  });

  it("getMessagesSince filters by timestamp and excludes bot messages", () => {
    const db = initMemoryDb();
    storeMessage(db, makeMsg({ id: "1", timestamp: "2024-01-01T10:00:00.000Z" }));
    storeMessage(db, makeMsg({ id: "2", timestamp: "2024-01-01T11:00:00.000Z" }));
    storeMessage(
      db,
      makeMsg({ id: "3", timestamp: "2024-01-01T12:00:00.000Z", isBotMessage: true }),
    );

    const rows = getMessagesSince(db, "chat-1", "2024-01-01T10:30:00.000Z");
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("2");
  });

  it("getNewMessages returns across multiple groups", () => {
    const db = initMemoryDb();
    storeMessage(db, makeMsg({ id: "1", chatId: "chat-1", timestamp: "2024-01-01T10:00:00.000Z" }));
    storeMessage(db, makeMsg({ id: "2", chatId: "chat-2", timestamp: "2024-01-01T10:01:00.000Z" }));
    storeMessage(db, makeMsg({ id: "3", chatId: "chat-3", timestamp: "2024-01-01T10:02:00.000Z" }));

    const rows = getNewMessages(db, ["chat-1", "chat-2"], "2024-01-01T09:00:00.000Z");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.chatId)).toEqual(["chat-1", "chat-2"]);
  });

  it("getNewMessages with empty chatIds returns all chats", () => {
    const db = initMemoryDb();
    storeMessage(db, makeMsg({ id: "1", chatId: "chat-1", timestamp: "2024-01-01T10:00:00.000Z" }));
    storeMessage(db, makeMsg({ id: "2", chatId: "chat-2", timestamp: "2024-01-01T10:01:00.000Z" }));

    const rows = getNewMessages(db, [], "2024-01-01T09:00:00.000Z");
    expect(rows).toHaveLength(2);
  });

  it("message query LIMIT caps results", () => {
    const db = initMemoryDb();
    for (let i = 0; i < 10; i++) {
      storeMessage(db, makeMsg({ id: `m-${i}`, timestamp: `2024-01-01T10:0${i}:00.000Z` }));
    }

    const rows = getMessagesSince(db, "chat-1", "2024-01-01T09:00:00.000Z", 3);
    expect(rows).toHaveLength(3);
    // Should return the first 3 chronologically (ASC order)
    expect(rows[0].id).toBe("m-0");
  });

  it("storeChatMetadata upserts and preserves existing name if not provided", () => {
    const db = initMemoryDb();
    storeChatMetadata(db, "chat-1", { name: "Family Chat", channel: "telegram", isGroup: true });

    // Update without name
    storeChatMetadata(db, "chat-1", { lastMessageAt: "2024-01-01T12:00:00.000Z" });

    const row = db.prepare("SELECT * FROM chats WHERE id = ?").get("chat-1") as {
      name: string;
      channel: string;
    };
    expect(row.name).toBe("Family Chat");
  });

  it("router state get/set round-trip", () => {
    const db = initMemoryDb();
    expect(getRouterState(db, "cursor")).toBeUndefined();

    setRouterState(db, "cursor", "2024-01-01T10:00:00.000Z");
    expect(getRouterState(db, "cursor")).toBe("2024-01-01T10:00:00.000Z");

    setRouterState(db, "cursor", "2024-01-01T11:00:00.000Z");
    expect(getRouterState(db, "cursor")).toBe("2024-01-01T11:00:00.000Z");
  });

  it("uses parameterized queries (no SQL injection)", () => {
    const db = initMemoryDb();
    const malicious = makeMsg({
      id: "1",
      content: "'; DROP TABLE messages; --",
      senderName: "'; DROP TABLE chats; --",
    });
    storeMessage(db, malicious);

    const rows = getMessagesSince(db, "chat-1", "1970-01-01T00:00:00.000Z");
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe("'; DROP TABLE messages; --");

    // Tables should still exist
    const tableCount = db
      .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name='messages'")
      .get() as { cnt: number };
    expect(tableCount.cnt).toBe(1);
  });
});
