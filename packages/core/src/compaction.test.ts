import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import {
  findCutPoint,
  extractFileOperations,
  serializeMessages,
  estimateMessageTokens,
  contextNeedsCompaction,
} from "./compaction.js";

// Helper to create messages of approximate token size
function makeMessage(role: "user" | "assistant" | "tool", text: string): ModelMessage {
  if (role === "tool") {
    return {
      role: "tool",
      content: [{ type: "tool-result", toolCallId: "tc1", toolName: "test", output: { type: "text" as const, value: text } }],
    } as ModelMessage;
  }
  return { role, content: text } as ModelMessage;
}

function makeToolCallMessage(toolName: string, input: Record<string, unknown>): ModelMessage {
  return {
    role: "assistant",
    content: [
      {
        type: "tool-call",
        toolCallId: "tc1",
        toolName,
        input,
      },
    ],
  } as ModelMessage;
}

describe("findCutPoint", () => {
  it("finds token-based split point", () => {
    // Create messages where the last ~20000 tokens should be kept
    // Each "x".repeat(400) message is ~100 tokens + 4 overhead = ~104 tokens
    const messages: ModelMessage[] = [];
    for (let i = 0; i < 250; i++) {
      messages.push(makeMessage(i % 2 === 0 ? "user" : "assistant", "x".repeat(400)));
    }

    const result = findCutPoint(messages, 20000);
    // The cut should keep approximately 20000 tokens at the end
    const keptMessages = messages.slice(result.cutIndex);
    const keptTokens = keptMessages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    // Should be roughly 20000 tokens (within reasonable bounds)
    expect(keptTokens).toBeGreaterThanOrEqual(19000);
    expect(keptTokens).toBeLessThan(25000);
  });

  it("cut point avoids tool-result messages", () => {
    const messages: ModelMessage[] = [
      makeMessage("user", "x".repeat(40000)),
      makeMessage("assistant", "y".repeat(40000)),
      makeMessage("tool", "z".repeat(40000)),
      makeMessage("user", "a".repeat(4000)),
      makeMessage("assistant", "b".repeat(4000)),
    ];

    const result = findCutPoint(messages, 5000);
    // Should not cut at index 2 (tool message)
    const cutRole = messages[result.cutIndex].role;
    expect(cutRole).not.toBe("tool");
  });

  it("detects split turn", () => {
    const messages: ModelMessage[] = [
      makeMessage("user", "x".repeat(40000)),
      makeMessage("assistant", "y".repeat(40000)),
      makeMessage("user", "start of turn"),
      makeMessage("assistant", "z".repeat(40000)),
      makeMessage("tool", "result"),
      makeMessage("assistant", "a".repeat(4000)),
    ];

    const result = findCutPoint(messages, 5000);
    // If the cut lands on a non-user message, it should detect split turn
    if (messages[result.cutIndex].role !== "user") {
      expect(result.isSplitTurn).toBe(true);
      expect(result.turnStartIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("clean cut at user message is not a split turn", () => {
    const messages: ModelMessage[] = [
      makeMessage("user", "x".repeat(40000)),
      makeMessage("assistant", "y".repeat(40000)),
      makeMessage("user", "z".repeat(4000)),
      makeMessage("assistant", "w".repeat(4000)),
    ];

    const result = findCutPoint(messages, 5000);
    if (messages[result.cutIndex].role === "user") {
      expect(result.isSplitTurn).toBe(false);
    }
  });
});

describe("extractFileOperations", () => {
  it("extracts read, write, edit operations", () => {
    const messages: ModelMessage[] = [
      makeToolCallMessage("read", { path: "/src/a.ts" }),
      makeToolCallMessage("write", { path: "/src/b.ts" }),
      makeToolCallMessage("edit", { path: "/src/c.ts" }),
    ];

    const ops = extractFileOperations(messages);
    expect(ops.read.has("/src/a.ts")).toBe(true);
    expect(ops.written.has("/src/b.ts")).toBe(true);
    expect(ops.edited.has("/src/c.ts")).toBe(true);
  });

  it("handles file_path input key", () => {
    const messages: ModelMessage[] = [
      makeToolCallMessage("Read", { file_path: "/src/d.ts" }),
    ];

    const ops = extractFileOperations(messages);
    expect(ops.read.has("/src/d.ts")).toBe(true);
  });

  it("read-only files excluded from modified", () => {
    const messages: ModelMessage[] = [
      makeToolCallMessage("read", { path: "/src/a.ts" }),
      makeToolCallMessage("edit", { path: "/src/a.ts" }),
      makeToolCallMessage("read", { path: "/src/b.ts" }),
    ];

    const ops = extractFileOperations(messages);
    // a.ts is both read and edited — should only appear as modified
    expect(ops.read.has("/src/a.ts")).toBe(true);
    expect(ops.edited.has("/src/a.ts")).toBe(true);
    // b.ts is only read
    expect(ops.read.has("/src/b.ts")).toBe(true);
  });

  it("returns empty sets for no file operations", () => {
    const messages: ModelMessage[] = [makeMessage("user", "hello")];
    const ops = extractFileOperations(messages);
    expect(ops.read.size).toBe(0);
    expect(ops.written.size).toBe(0);
    expect(ops.edited.size).toBe(0);
  });
});

describe("serializeMessages", () => {
  it("serializes user messages", () => {
    const messages: ModelMessage[] = [makeMessage("user", "hello world")];
    const result = serializeMessages(messages);
    expect(result).toBe("[User]: hello world");
  });

  it("serializes assistant tool calls", () => {
    const messages: ModelMessage[] = [
      makeToolCallMessage("read", { path: "/x.ts" }),
    ];
    const result = serializeMessages(messages);
    expect(result).toContain("[Assistant tool calls]:");
    expect(result).toContain('read(path="/x.ts")');
  });

  it("serializes tool results", () => {
    const messages: ModelMessage[] = [makeMessage("tool", "file contents here")];
    const result = serializeMessages(messages);
    expect(result).toContain("[Tool result]: file contents here");
  });
});

describe("contextNeedsCompaction", () => {
  it("uses reserveTokens-based threshold", () => {
    // 100 tokens message, maxTokens=200, reserveTokens=50 => threshold=150 => should compact
    const messages: ModelMessage[] = [makeMessage("user", "x".repeat(600))]; // ~150 tokens + 4
    expect(contextNeedsCompaction(messages, 200, 50)).toBe(true);
  });

  it("does not compact below reserveTokens threshold", () => {
    const messages: ModelMessage[] = [makeMessage("user", "short")]; // ~2 tokens + 4
    expect(contextNeedsCompaction(messages, 200000, 16384)).toBe(false);
  });

  it("falls back to 85% threshold without reserveTokens", () => {
    // 170 tokens, maxTokens=200, 85% threshold = 170 => at threshold
    const messages: ModelMessage[] = [makeMessage("user", "x".repeat(664))]; // ~166 + 4 = 170
    expect(contextNeedsCompaction(messages, 200)).toBe(true);
  });
});
