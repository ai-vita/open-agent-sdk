import {
  generateText,
  type LanguageModel,
  type ModelMessage,
} from "ai";

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

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
      switch (part.type) {
        case "text":
        case "reasoning":
          tokens += estimateTokens(part.text);
          break;
        case "tool-result":
          tokens += estimateTokens(JSON.stringify(part.output));
          break;
        case "tool-call":
          tokens += estimateTokens(JSON.stringify(part.input));
          break;
        default:
          tokens += estimateTokens(JSON.stringify(part));
          break;
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
// File operations tracking
// ---------------------------------------------------------------------------

export interface FileOperations {
  read: Set<string>;
  written: Set<string>;
  edited: Set<string>;
}

/**
 * Extract file operations from tool calls in messages.
 * Scans assistant messages for read/write/edit tool calls and collects file paths.
 */
export function extractFileOperations(messages: ModelMessage[]): FileOperations {
  const fileOps: FileOperations = {
    read: new Set(),
    written: new Set(),
    edited: new Set(),
  };

  for (const msg of messages) {
    if (msg.role !== "assistant" || typeof msg.content === "string") continue;

    for (const block of msg.content) {
      if (block.type !== "tool-call") continue;

      const input = block.input as Record<string, unknown> | undefined;
      if (!input) continue;

      const filePath =
        typeof input.path === "string"
          ? input.path
          : typeof input.file_path === "string"
            ? input.file_path
            : undefined;
      if (!filePath) continue;

      switch (block.toolName) {
        case "read":
        case "Read":
          fileOps.read.add(filePath);
          break;
        case "write":
        case "Write":
          fileOps.written.add(filePath);
          break;
        case "edit":
        case "Edit":
          fileOps.edited.add(filePath);
          break;
      }
    }
  }

  return fileOps;
}

/**
 * Compute final file lists: read-only files and modified files.
 * Files that were both read and modified appear only in modified.
 */
function computeFileLists(fileOps: FileOperations): {
  readFiles: string[];
  modifiedFiles: string[];
} {
  const modified = new Set([...fileOps.edited, ...fileOps.written]);
  const readOnly = [...fileOps.read].filter((f) => !modified.has(f)).sort();
  const modifiedFiles = [...modified].sort();
  return { readFiles: readOnly, modifiedFiles };
}

/**
 * Format file operations as XML tags for appending to summary.
 */
function formatFileOperations(readFiles: string[], modifiedFiles: string[]): string {
  const sections: string[] = [];
  if (readFiles.length > 0) {
    sections.push(`<read-files>\n${readFiles.join("\n")}\n</read-files>`);
  }
  if (modifiedFiles.length > 0) {
    sections.push(`<modified-files>\n${modifiedFiles.join("\n")}\n</modified-files>`);
  }
  if (sections.length === 0) return "";
  return `\n\n${sections.join("\n\n")}`;
}

// ---------------------------------------------------------------------------
// Message serialization
// ---------------------------------------------------------------------------

/**
 * Serialize messages to human-readable text for summarization.
 */
export function serializeMessages(messages: ModelMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    switch (msg.role) {
      case "user": {
        if (typeof msg.content === "string") {
          if (msg.content) parts.push(`[User]: ${msg.content}`);
          break;
        }
        const texts: string[] = [];
        for (const block of msg.content) {
          if (block.type === "text") texts.push(block.text);
        }
        const content = texts.join("");
        if (content) parts.push(`[User]: ${content}`);
        break;
      }
      case "assistant": {
        if (typeof msg.content === "string") {
          if (msg.content) parts.push(`[Assistant]: ${msg.content}`);
          break;
        }
        const textParts: string[] = [];
        const thinkingParts: string[] = [];
        const toolCalls: string[] = [];

        for (const block of msg.content) {
          switch (block.type) {
            case "text":
              textParts.push(block.text);
              break;
            case "reasoning":
              thinkingParts.push(block.text);
              break;
            case "tool-call": {
              toolCalls.push(`${block.toolName}(${JSON.stringify(block.input)})`);
              break;
            }
          }
        }

        if (thinkingParts.length > 0) {
          parts.push(`[Assistant thinking]: ${thinkingParts.join("\n")}`);
        }
        if (textParts.length > 0) {
          parts.push(`[Assistant]: ${textParts.join("\n")}`);
        }
        if (toolCalls.length > 0) {
          parts.push(`[Assistant tool calls]: ${toolCalls.join("; ")}`);
        }
        break;
      }
      case "tool": {
        const toolResults: string[] = [];
        for (const block of msg.content) {
          if (block.type !== "tool-result") continue;
          switch (block.output.type) {
            case "text":
            case "error-text":
              toolResults.push(block.output.value);
              break;
            case "json":
            case "error-json":
              toolResults.push(JSON.stringify(block.output.value));
              break;
          }
        }
        if (toolResults.length > 0) {
          parts.push(`[Tool result]: ${toolResults.join("\n")}`);
        }
        break;
      }
    }
  }

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Summarization prompts
// ---------------------------------------------------------------------------

const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI coding assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

const TURN_PREFIX_SUMMARIZATION_PROMPT = `This is the PREFIX of a turn that was too large to keep. The SUFFIX (recent work) is retained.

Summarize the prefix to provide context for the retained suffix:

## Original Request
[What did the user ask for in this turn?]

## Early Progress
- [Key decisions and work done in the prefix]

## Context for Suffix
- [Information needed to understand the retained recent work]

Be concise. Focus on what's needed to understand the kept suffix.`;

// ---------------------------------------------------------------------------
// Cut point detection
// ---------------------------------------------------------------------------

interface CutPointResult {
  cutIndex: number;
  turnStartIndex: number;
  isSplitTurn: boolean;
}

/**
 * Find a valid cut point that preserves approximately keepRecentTokens.
 * Never cuts mid-tool-result — only at user or assistant message boundaries.
 */
export function findCutPoint(messages: ModelMessage[], keepRecentTokens: number): CutPointResult {
  // Find valid cut points (user or assistant boundaries, never tool results)
  const validCutIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const role = messages[i].role;
    if (role === "user" || role === "assistant") {
      validCutIndices.push(i);
    }
  }

  if (validCutIndices.length === 0) {
    return { cutIndex: 0, turnStartIndex: -1, isSplitTurn: false };
  }

  // Walk backwards accumulating tokens until we exceed the budget
  let accumulatedTokens = 0;
  let cutIndex = validCutIndices[0];

  for (let i = messages.length - 1; i >= 0; i--) {
    accumulatedTokens += estimateMessageTokens(messages[i]);
    if (accumulatedTokens >= keepRecentTokens) {
      // Find the nearest valid cut point at or after this index
      for (const ci of validCutIndices) {
        if (ci >= i) {
          cutIndex = ci;
          break;
        }
      }
      break;
    }
  }

  // Check if this is a split turn (cut is at an assistant message, not a user message)
  const cutMessage = messages[cutIndex];
  const isUserMessage = cutMessage.role === "user";

  let turnStartIndex = -1;
  if (!isUserMessage) {
    // Walk backwards to find the user message that starts this turn
    for (let i = cutIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        turnStartIndex = i;
        break;
      }
    }
  }

  return {
    cutIndex,
    turnStartIndex,
    isSplitTurn: !isUserMessage && turnStartIndex !== -1,
  };
}

// ---------------------------------------------------------------------------
// Context compaction
// ---------------------------------------------------------------------------

export interface CompactConversationConfig {
  /** Model's context limit (e.g., 200000 for Claude) */
  maxTokens: number;
  /** Keep this many tokens of recent conversation intact (default: 20000) */
  keepRecentTokens?: number;
  /** Reserve this many tokens for summary output (default: 16384) */
  reserveTokens?: number;
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
 * Uses token-based splitting with structured summarization.
 */
export async function compactConversation(
  messages: ModelMessage[],
  config: CompactConversationConfig,
  state: CompactConversationState = { conversationSummary: "" },
): Promise<CompactConversationResult> {
  const reserveTokens = config.reserveTokens ?? 16384;
  const keepRecentTokens = config.keepRecentTokens ?? 20000;

  const currentTokens = estimateMessagesTokens(messages);
  const threshold = config.maxTokens - reserveTokens;

  if (currentTokens <= threshold) {
    return { messages, state, didCompact: false };
  }

  // Find the token-based cut point
  const { cutIndex, turnStartIndex, isSplitTurn } = findCutPoint(messages, keepRecentTokens);

  // If not enough messages to meaningfully compact
  if (cutIndex <= 0) {
    return { messages, state, didCompact: false };
  }

  // Determine what to summarize
  const historyEnd = isSplitTurn ? turnStartIndex : cutIndex;
  const messagesToSummarize = messages.slice(0, historyEnd);
  const turnPrefixMessages = isSplitTurn ? messages.slice(turnStartIndex, cutIndex) : [];
  const recentMessages = messages.slice(cutIndex);

  // Extract file operations from messages being summarized
  const allSummarizedMessages = [...messagesToSummarize, ...turnPrefixMessages];
  const fileOps = extractFileOperations(allSummarizedMessages);

  // Generate summary
  let summary: string;
  const maxOutputTokens = Math.floor(0.8 * reserveTokens);

  if (isSplitTurn && turnPrefixMessages.length > 0) {
    // Parallel summarization for split turns
    const turnPrefixMaxTokens = Math.floor(0.5 * reserveTokens);
    const [historySummary, turnPrefixSummary] = await Promise.all([
      messagesToSummarize.length > 0
        ? generateSummary(messagesToSummarize, config, state, maxOutputTokens)
        : Promise.resolve("No prior history."),
      generateTurnPrefixSummary(turnPrefixMessages, config, turnPrefixMaxTokens),
    ]);
    summary = `${historySummary}\n\n---\n\n**Turn Context (split turn):**\n\n${turnPrefixSummary}`;
  } else {
    summary = await generateSummary(messagesToSummarize, config, state, maxOutputTokens);
  }

  // Append file operations
  const { readFiles, modifiedFiles } = computeFileLists(fileOps);
  summary += formatFileOperations(readFiles, modifiedFiles);

  // Build compacted messages
  const compactedMessages: ModelMessage[] = [
    {
      role: "user",
      content: `[Previous conversation summary]\n${summary}`,
    },
    {
      role: "assistant",
      content: "I have reviewed the summary of our previous conversation and will continue from there.",
    },
    ...recentMessages,
  ];

  return {
    messages: compactedMessages,
    state: { conversationSummary: summary },
    didCompact: true,
  };
}

async function generateSummary(
  messages: ModelMessage[],
  config: CompactConversationConfig,
  state: CompactConversationState,
  maxOutputTokens: number,
): Promise<string> {
  const conversationText = serializeMessages(messages);
  const hasPreviousSummary = state.conversationSummary.length > 0;
  const basePrompt = hasPreviousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;

  let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
  if (hasPreviousSummary) {
    promptText += `<previous-summary>\n${state.conversationSummary}\n</previous-summary>\n\n`;
  }
  if (config.taskContext) {
    promptText += `Task context: ${config.taskContext}\n\n`;
  }
  if (config.summaryInstructions) {
    promptText += `Additional instructions: ${config.summaryInstructions}\n\n`;
  }
  promptText += basePrompt;

  const result = await generateText({
    model: config.summarizerModel,
    system: SUMMARIZATION_SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: promptText }],
    maxOutputTokens,
  });

  return result.text;
}

async function generateTurnPrefixSummary(
  messages: ModelMessage[],
  config: CompactConversationConfig,
  maxOutputTokens: number,
): Promise<string> {
  const conversationText = serializeMessages(messages);
  const promptText = `<conversation>\n${conversationText}\n</conversation>\n\n${TURN_PREFIX_SUMMARIZATION_PROMPT}`;

  const result = await generateText({
    model: config.summarizerModel,
    system: SUMMARIZATION_SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: promptText }],
    maxOutputTokens,
  });

  return result.text;
}

/**
 * Check whether the conversation is approaching context limits.
 * Uses reserveTokens-based threshold when provided.
 */
export function contextNeedsCompaction(
  messages: ModelMessage[],
  maxTokens: number,
  reserveTokens?: number,
): boolean {
  const tokens = estimateMessagesTokens(messages);
  if (reserveTokens !== undefined) {
    return tokens > maxTokens - reserveTokens;
  }
  // Legacy: default 85% threshold
  return tokens >= Math.floor(maxTokens * 0.85);
}
