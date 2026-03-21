import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "./session-manager.js";
import type { MessageEntry } from "./types.js";

describe("SessionManager", () => {
  let testDir: string;
  let sessionPath: string;

  beforeEach(() => {
    testDir = path.join(
      tmpdir(),
      `session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
    sessionPath = path.join(testDir, "session.jsonl");
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("defers file creation until first message", () => {
    const sm = new SessionManager(sessionPath);
    expect(existsSync(sessionPath)).toBe(false);
    sm.append({ role: "user", content: "hello" });
    expect(existsSync(sessionPath)).toBe(true);
  });

  it("appends a single message", () => {
    const sm = new SessionManager(sessionPath);
    sm.append({ role: "user", content: "hello" });
    const messages = sm.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "hello" });
  });

  it("appends multiple messages with correct ordering", () => {
    const sm = new SessionManager(sessionPath);
    sm.append({ role: "user", content: "hello" });
    sm.append({ role: "assistant", content: "hi there" });
    sm.append({ role: "user", content: "how are you?" });

    const messages = sm.getMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "hi there" });
    expect(messages[2]).toEqual({ role: "user", content: "how are you?" });
  });

  it("getMessages returns empty array for new session", () => {
    const sm = new SessionManager(sessionPath);
    expect(sm.getMessages()).toEqual([]);
  });

  it("supports branching", () => {
    const sm = new SessionManager(sessionPath);
    sm.append({ role: "user", content: "msg1" });
    const id2 = sm.append({ role: "assistant", content: "msg2" });
    sm.append({ role: "user", content: "msg3" });
    sm.append({ role: "assistant", content: "msg4" });
    sm.append({ role: "user", content: "msg5" });

    sm.branch(id2, "Exploring different approach");

    const messages = sm.getMessages();
    // Should have: msg1, msg2, branch summary
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "msg1" });
    expect(messages[1]).toEqual({ role: "assistant", content: "msg2" });
    expect(messages[2].content as string).toContain("Branch point");
  });

  it("supports compaction entries", () => {
    const sm = new SessionManager(sessionPath);
    const id1 = sm.append({ role: "user", content: "old message 1" });
    const id2 = sm.append({ role: "assistant", content: "old message 2" });
    sm.append({ role: "user", content: "recent message" });

    sm.appendCompaction("Summary of old messages", [id1, id2]);

    const messages = sm.getMessages();
    // Should have: summary (user), ack (assistant), recent message, compaction summary, ack
    // Actually: the compacted entries are excluded, compaction entry adds summary+ack, plus remaining
    // Let's check what we get
    const summaryMsg = messages.find(
      (m) => typeof m.content === "string" && m.content.includes("Summary of old messages"),
    );
    expect(summaryMsg).toBeDefined();
  });

  it("getPathEntries returns entries in root-to-leaf order", () => {
    const sm = new SessionManager(sessionPath);
    sm.append({ role: "user", content: "hello" });
    sm.append({ role: "assistant", content: "hi" });
    sm.append({ role: "user", content: "bye" });

    const entries = sm.getPathEntries();
    expect(entries).toHaveLength(3);
    expect(entries[0].type).toBe("message");
    expect(entries[2].type).toBe("message");
    // Verify order: first entry has no parent
    expect(entries[0].parentId).toBeNull();
    // Each subsequent entry's parentId is the previous entry's id
    expect(entries[1].parentId).toBe(entries[0].id);
    expect(entries[2].parentId).toBe(entries[1].id);
  });

  it("getPathEntries returns empty array for new session", () => {
    const sm = new SessionManager(sessionPath);
    expect(sm.getPathEntries()).toEqual([]);
  });

  it("getPathEntries includes compaction and branch entries", () => {
    const sm = new SessionManager(sessionPath);
    const id1 = sm.append({ role: "user", content: "msg1" });
    const id2 = sm.append({ role: "assistant", content: "msg2" });
    sm.append({ role: "user", content: "msg3" });

    sm.appendCompaction("summary", [id1, id2]);

    const entries = sm.getPathEntries();
    const types = entries.map((e) => e.type);
    expect(types).toContain("compaction");
    expect(types).toContain("message");
  });

  it("getPathEntries follows branch path", () => {
    const sm = new SessionManager(sessionPath);
    sm.append({ role: "user", content: "msg1" });
    const id2 = sm.append({ role: "assistant", content: "msg2" });
    sm.append({ role: "user", content: "msg3-abandoned" });

    sm.branch(id2, "new direction");
    sm.append({ role: "user", content: "msg3-new" });

    const entries = sm.getPathEntries();
    const messages = entries
      .filter((e): e is MessageEntry => e.type === "message")
      .map((e) => e.message.content);
    expect(messages).toContain("msg1");
    expect(messages).toContain("msg2");
    expect(messages).toContain("msg3-new");
    expect(messages).not.toContain("msg3-abandoned");
  });

  it("resumes from existing file", () => {
    const sm1 = new SessionManager(sessionPath);
    sm1.append({ role: "user", content: "persisted message" });
    sm1.append({ role: "assistant", content: "persisted response" });

    // Create a new SessionManager from the same file
    const sm2 = new SessionManager(sessionPath);
    const messages = sm2.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "user", content: "persisted message" });
    expect(messages[1]).toEqual({ role: "assistant", content: "persisted response" });
  });
});
