import type { SessionEntry } from "@open-agent-sdk/core";
import type { AssistantModelMessage, UserModelMessage } from "ai";

const MAX_ASSISTANT_TEXT_LENGTH = 500;
const MAX_USER_TURNS = 5;

/**
 * Render session history to a string for display on resume.
 * Shows last N user turns with assistant responses, tool call summaries,
 * and compaction summaries for older content.
 */
export function renderSessionHistory(entries: SessionEntry[]): string {
  if (entries.length === 0) return "";

  // Group entries into user turns: each turn starts with a user message
  // and includes all entries until the next user message.
  const turns: SessionEntry[][] = [];
  let currentTurn: SessionEntry[] = [];

  for (const entry of entries) {
    if (entry.type === "message" && entry.message.role === "user") {
      if (currentTurn.length > 0) {
        turns.push(currentTurn);
      }
      currentTurn = [entry];
    } else {
      currentTurn.push(entry);
    }
  }
  if (currentTurn.length > 0) {
    turns.push(currentTurn);
  }

  // Separate compaction-only turns from user turns
  const compactionTurns: SessionEntry[][] = [];
  const userTurns: SessionEntry[][] = [];

  for (const turn of turns) {
    const hasUserMessage = turn.some((e) => e.type === "message" && e.message.role === "user");
    if (hasUserMessage) {
      userTurns.push(turn);
    } else {
      compactionTurns.push(turn);
    }
  }

  const lines: string[] = [];

  // Determine truncation
  const showFrom = Math.max(0, userTurns.length - MAX_USER_TURNS);

  // Show compaction summary and/or truncation indicator
  if (showFrom > 0 || compactionTurns.length > 0) {
    for (const turn of compactionTurns) {
      for (const entry of turn) {
        if (entry.type === "compaction") {
          lines.push(`  │ Summary: ${truncate(entry.summary, 200)}`);
        }
      }
    }
    if (showFrom > 0) {
      lines.push(`  ... (${showFrom} earlier turn${showFrom === 1 ? "" : "s"})`);
    }
    lines.push("");
  }

  // Render visible turns
  for (let i = showFrom; i < userTurns.length; i++) {
    for (const entry of userTurns[i]) {
      lines.push(...renderEntry(entry));
    }
  }

  return lines.join("\n");
}

function renderEntry(entry: SessionEntry): string[] {
  if (entry.type === "compaction") {
    return [`  │ Summary: ${truncate(entry.summary, 200)}`];
  }
  if (entry.type === "branch_summary") {
    return [`  │ Branch: ${entry.reason}`];
  }
  if (entry.type !== "message") return [];

  const { message } = entry;
  if (message.role === "user") {
    return renderUserMessage(message);
  }
  if (message.role === "assistant") {
    return renderAssistantMessage(message);
  }
  // Skip tool-role messages
  return [];
}

function renderUserMessage(message: UserModelMessage): string[] {
  const text =
    typeof message.content === "string"
      ? message.content
      : (message.content.find((p) => p.type === "text")?.text ?? "");
  return text ? [`> ${text}`] : [];
}

function renderAssistantMessage(message: AssistantModelMessage): string[] {
  const lines: string[] = [];
  const parts = Array.isArray(message.content)
    ? message.content
    : [{ type: "text" as const, text: String(message.content) }];

  for (const part of parts) {
    if (part.type === "text" && part.text) {
      lines.push(truncate(part.text, MAX_ASSISTANT_TEXT_LENGTH));
    } else if (part.type === "tool-call") {
      lines.push(`[tool] ${part.toolName}(${JSON.stringify(part.input).slice(0, 80)}...)`);
    }
  }
  return lines;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}
