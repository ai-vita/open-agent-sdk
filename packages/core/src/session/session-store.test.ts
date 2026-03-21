import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "./session-manager.js";
import type { SessionStore } from "./session-store.js";
import type { MessageEntry } from "./types.js";

/**
 * Contract tests for the SessionStore interface.
 * Any implementation of SessionStore must pass these tests.
 * Currently validates SessionManager; SqliteSessionStore will reuse the same assertions.
 */
function sessionStoreContractTests(createStore: () => SessionStore) {
  it("append → getMessages round-trip", () => {
    const store = createStore();
    store.append({ role: "user", content: "hello" });
    store.append({ role: "assistant", content: "hi there" });

    const messages = store.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "hi there" });
  });

  it("getMessages returns empty array for empty store", () => {
    const store = createStore();
    expect(store.getMessages()).toEqual([]);
  });

  it("appendCompaction substitutes compacted messages with summary", () => {
    const store = createStore();
    const id1 = store.append({ role: "user", content: "old message 1" });
    const id2 = store.append({ role: "assistant", content: "old message 2" });
    store.append({ role: "user", content: "recent message" });

    store.appendCompaction("Summary of old messages", [id1, id2]);

    const messages = store.getMessages();
    // Compacted messages should be replaced by summary + ack
    const contents = messages.map((m) => (typeof m.content === "string" ? m.content : ""));
    expect(contents.some((c) => c.includes("Summary of old messages"))).toBe(true);
    expect(contents.some((c) => c === "old message 1")).toBe(false);
    expect(contents.some((c) => c === "old message 2")).toBe(false);
    // Recent message should still be present
    expect(contents.some((c) => c === "recent message")).toBe(true);
  });

  it("branch throws on unknown entryId", () => {
    const store = createStore();
    store.append({ role: "user", content: "hello" });
    expect(() => store.branch("nonexistent-id", "reason")).toThrow();
  });

  it("branch forks from earlier entry", () => {
    const store = createStore();
    store.append({ role: "user", content: "msg1" });
    const id2 = store.append({ role: "assistant", content: "msg2" });
    store.append({ role: "user", content: "msg3-abandoned" });

    store.branch(id2, "new direction");
    store.append({ role: "user", content: "msg3-new" });

    const messages = store.getMessages();
    const contents = messages.map((m) => (typeof m.content === "string" ? m.content : ""));
    expect(contents).toContain("msg1");
    expect(contents).toContain("msg2");
    expect(contents).toContain("msg3-new");
    expect(contents).not.toContain("msg3-abandoned");
  });

  it("getPathEntries returns root-to-leaf order", () => {
    const store = createStore();
    store.append({ role: "user", content: "hello" });
    store.append({ role: "assistant", content: "hi" });
    store.append({ role: "user", content: "bye" });

    const entries = store.getPathEntries();
    expect(entries).toHaveLength(3);
    // First entry has no parent
    expect(entries[0].parentId).toBeNull();
    // Each subsequent entry's parentId is the previous entry's id
    expect(entries[1].parentId).toBe(entries[0].id);
    expect(entries[2].parentId).toBe(entries[1].id);
  });

  it("getLeafId tracks latest entry", () => {
    const store = createStore();
    expect(store.getLeafId()).toBeNull();

    const id1 = store.append({ role: "user", content: "hello" });
    expect(store.getLeafId()).toBe(id1);

    const id2 = store.append({ role: "assistant", content: "hi" });
    expect(store.getLeafId()).toBe(id2);
  });

  it("getLeafId updates after compaction", () => {
    const store = createStore();
    const id1 = store.append({ role: "user", content: "old" });
    store.append({ role: "assistant", content: "old reply" });
    store.append({ role: "user", content: "recent" });

    const compactionId = store.appendCompaction("Summary", [id1]);
    expect(store.getLeafId()).toBe(compactionId);
  });

  it("getLeafId updates after branch", () => {
    const store = createStore();
    store.append({ role: "user", content: "msg1" });
    const id2 = store.append({ role: "assistant", content: "msg2" });
    store.append({ role: "user", content: "msg3" });

    const branchId = store.branch(id2, "reason");
    expect(store.getLeafId()).toBe(branchId);
  });

  it("getPathEntries follows branch path correctly", () => {
    const store = createStore();
    store.append({ role: "user", content: "msg1" });
    const id2 = store.append({ role: "assistant", content: "msg2" });
    store.append({ role: "user", content: "msg3-abandoned" });

    store.branch(id2, "new direction");
    store.append({ role: "user", content: "msg3-new" });

    const entries = store.getPathEntries();
    const messageEntries = entries
      .filter((e): e is MessageEntry => e.type === "message")
      .map((e) => e.message.content);
    expect(messageEntries).toContain("msg1");
    expect(messageEntries).toContain("msg2");
    expect(messageEntries).toContain("msg3-new");
    expect(messageEntries).not.toContain("msg3-abandoned");
  });
}

describe("SessionStore contract — SessionManager", () => {
  let testDir: string;
  let sessionPath: string;

  beforeEach(() => {
    testDir = path.join(
      tmpdir(),
      `session-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    sessionPath = path.join(testDir, "session.jsonl");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  sessionStoreContractTests(() => new SessionManager(sessionPath));
});
