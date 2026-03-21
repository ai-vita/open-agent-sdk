import type { CompactionEntry, MessageEntry, SessionEntry } from "@open-agent-sdk/core";
import type { AssistantModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { renderSessionHistory } from "./history.js";

function msg(role: "user" | "assistant", content: string, id?: string): MessageEntry {
  return {
    type: "message",
    id: id ?? Math.random().toString(36).slice(2),
    parentId: null,
    timestamp: new Date().toISOString(),
    message: { role, content },
  };
}

function toolCallMsg(toolName: string, input: unknown, text?: string): MessageEntry {
  const parts: AssistantModelMessage["content"] = [];
  if (text) parts.push({ type: "text", text });
  parts.push({ type: "tool-call", toolCallId: "tc-1", toolName, input });
  return {
    type: "message",
    id: Math.random().toString(36).slice(2),
    parentId: null,
    timestamp: new Date().toISOString(),
    message: { role: "assistant", content: parts },
  };
}

describe("renderSessionHistory", () => {
  it("returns empty string for no entries", () => {
    expect(renderSessionHistory([])).toBe("");
  });

  it("renders a simple user/assistant exchange", () => {
    const entries: SessionEntry[] = [msg("user", "hello"), msg("assistant", "hi there")];
    const output = renderSessionHistory(entries);
    expect(output).toContain("> hello");
    expect(output).toContain("hi there");
  });

  it("renders tool calls as one-liners", () => {
    const entries: SessionEntry[] = [
      msg("user", "read the file"),
      toolCallMsg("ReadFile", { path: "src/foo.ts" }, "Let me read that."),
    ];
    const output = renderSessionHistory(entries);
    expect(output).toContain("> read the file");
    expect(output).toContain("[tool] ReadFile(");
    expect(output).toContain("Let me read that.");
  });

  it("truncates long assistant text", () => {
    const longText = "x".repeat(1000);
    const entries: SessionEntry[] = [msg("user", "go"), msg("assistant", longText)];
    const output = renderSessionHistory(entries);
    expect(output).toContain("...");
    expect(output.length).toBeLessThan(1000);
  });

  it("shows last 5 user turns and truncation indicator", () => {
    const entries: SessionEntry[] = [];
    for (let i = 1; i <= 8; i++) {
      entries.push(msg("user", `question ${i}`));
      entries.push(msg("assistant", `answer ${i}`));
    }
    const output = renderSessionHistory(entries);
    // Should show turns 4-8 (last 5)
    expect(output).toContain("question 4");
    expect(output).toContain("question 8");
    expect(output).not.toContain("question 1");
    expect(output).not.toContain("question 3");
    expect(output).toContain("3 earlier turns");
  });

  it("shows all turns when 5 or fewer", () => {
    const entries: SessionEntry[] = [
      msg("user", "q1"),
      msg("assistant", "a1"),
      msg("user", "q2"),
      msg("assistant", "a2"),
    ];
    const output = renderSessionHistory(entries);
    expect(output).toContain("> q1");
    expect(output).toContain("> q2");
    expect(output).not.toContain("earlier");
  });

  it("renders compaction summary", () => {
    const compaction: CompactionEntry = {
      type: "compaction",
      id: "c1",
      parentId: null,
      timestamp: new Date().toISOString(),
      summary: "We discussed adding caching to the API.",
      compactedEntryIds: ["old1", "old2"],
    };
    const entries: SessionEntry[] = [
      compaction,
      msg("user", "now what?"),
      msg("assistant", "let's continue"),
    ];
    const output = renderSessionHistory(entries);
    expect(output).toContain("Summary: We discussed adding caching");
    expect(output).toContain("> now what?");
  });
});
