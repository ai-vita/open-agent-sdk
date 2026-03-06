// Sandbox interface
export type { Sandbox, ExecOptions, ExecResult, DirEntry } from "./sandbox.js";

// Tool types
export type { Tool, ToolSet, ToolConfig, SDKToolOptions, ToolResult } from "./tool-types.js";

// Agent events
export type {
  AgentEvent,
  AssistantMessageEvent,
  ToolCallEvent,
  ToolResultEvent,
  TextDeltaEvent,
  StepCompleteEvent,
  ErrorEvent,
  DoneEvent,
} from "./agent-events.js";

// Agent loop
export { runAgent, stepCountIs, budgetExceeded, composeStops } from "./agent.js";
export type { AgentOptions, StopWhen } from "./agent.js";

// Context compaction
export {
  compactConversation,
  contextNeedsCompaction,
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
} from "./compaction.js";
export type {
  CompactConversationConfig,
  CompactConversationState,
  CompactConversationResult,
} from "./compaction.js";

// Caching
export { cached, LRUCacheStore } from "./cache.js";
export type { CacheStore, CacheEntry, CacheOptions, CacheStats, CachedTool } from "./cache.js";

// Utilities
export { middleTruncate, isToolCallPart, isToolResultPart, sleep, clamp } from "./utils.js";
