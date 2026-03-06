import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  type ToolCallPart,
  type ToolResultPart,
} from "ai";

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

function isToolCallPart(part: unknown): part is ToolCallPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as Record<string, unknown>).type === "tool-call"
  );
}

function isToolResultPart(part: unknown): part is ToolResultPart {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as Record<string, unknown>).type === "tool-result"
  );
}

/**
 * Estimate token count for a string (~4 chars per token for English).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate token count for a single message.
 */
export function estimateMessageTokens(message: ModelMessage): number {
  let tokens = 0;

  if (typeof message.content === "string") {
    tokens += estimateTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (typeof part === "string") {
        tokens += estimateTokens(part);
      } else if ("text" in part && typeof (part as { text?: unknown }).text === "string") {
        tokens += estimateTokens((part as { text: string }).text);
      } else if (isToolResultPart(part)) {
        tokens += estimateTokens(JSON.stringify(part.output));
      } else if (isToolCallPart(part)) {
        tokens += estimateTokens(JSON.stringify(part.input));
      } else {
        tokens += estimateTokens(JSON.stringify(part));
      }
    }
  }

  // Overhead for role/metadata
  tokens += 4;
  return tokens;
}

/**
 * Estimate total token count for an array of messages.
 */
export function estimateMessagesTokens(messages: ModelMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
}

// ---------------------------------------------------------------------------
// Context compaction
// ---------------------------------------------------------------------------

export interface CompactConversationConfig {
  /** Model's context limit (e.g., 200000 for Claude) */
  maxTokens: number;
  /** Trigger compaction at this fraction of maxTokens (default: 0.85) */
  compactionThreshold?: number;
  /** Keep last N messages intact (default: 10) */
  protectRecentMessages?: number;
  /** Model to use for summarization */
  summarizerModel: LanguageModel;
  /** The task/goal the agent is working on */
  taskContext?: string;
  /** Extra instructions for the summarizer */
  summaryInstructions?: string;
}

export interface CompactConversationState {
  conversationSummary: string;
}

export interface CompactConversationResult {
  messages: ModelMessage[];
  state: CompactConversationState;
  didCompact: boolean;
}

/**
 * Compact a conversation when it exceeds the token threshold.
 * Summarizes older messages and preserves recent context.
 */
export async function compactConversation(
  messages: ModelMessage[],
  config: CompactConversationConfig,
  state: CompactConversationState = { conversationSummary: "" },
): Promise<CompactConversationResult> {
  const currentTokens = estimateMessagesTokens(messages);
  const threshold = config.compactionThreshold ?? 0.85;
  const limit = Math.floor(config.maxTokens * threshold);

  if (currentTokens <= limit) {
    return { messages, state, didCompact: false };
  }

  const protectCount = config.protectRecentMessages ?? 10;
  const totalMessages = messages.length;

  // If not enough messages to compact, return as-is
  if (totalMessages <= protectCount) {
    return { messages, state, didCompact: false };
  }

  const messagesToSummarize = messages.slice(0, totalMessages - protectCount);
  const recentMessages = messages.slice(totalMessages - protectCount);

  // Build summarization prompt
  const summaryText = messagesToSummarize
    .map((m) => {
      const role = m.role.toUpperCase();
      const content =
        typeof m.content === "string"
          ? m.content
          : JSON.stringify(m.content, null, 2);
      return `[${role}]: ${content}`;
    })
    .join("\n\n");

  const existingSummary = state.conversationSummary
    ? `Previous summary:\n${state.conversationSummary}\n\n`
    : "";

  const taskContext = config.taskContext
    ? `Task context: ${config.taskContext}\n\n`
    : "";

  const extraInstructions = config.summaryInstructions
    ? `\n\nAdditional instructions: ${config.summaryInstructions}`
    : "";

  const summarizerPrompt = `${taskContext}${existingSummary}Summarize the following conversation history concisely, preserving key decisions, findings, files modified, and important context needed to continue the task.${extraInstructions}\n\n${summaryText}`;

  const summaryResult = await generateText({
    model: config.summarizerModel,
    prompt: summarizerPrompt,
  });

  const newSummary = summaryResult.text;

  // Build compacted messages: system summary + recent messages
  const compactedMessages: ModelMessage[] = [
    {
      role: "user",
      content: `[Previous conversation summary]\n${newSummary}`,
    },
    {
      role: "assistant",
      content: "I have reviewed the summary of our previous conversation and will continue from there.",
    },
    ...recentMessages,
  ];

  return {
    messages: compactedMessages,
    state: { conversationSummary: newSummary },
    didCompact: true,
  };
}

/**
 * Check whether the conversation is approaching context limits.
 */
export function contextNeedsCompaction(
  messages: ModelMessage[],
  maxTokens: number,
  threshold = 0.85,
): boolean {
  const tokens = estimateMessagesTokens(messages);
  return tokens >= Math.floor(maxTokens * threshold);
}
