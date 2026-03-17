import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "./session-manager.js";

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

  it("creates a new session file", () => {
    new SessionManager(sessionPath);
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
