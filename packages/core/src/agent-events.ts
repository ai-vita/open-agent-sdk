import type { LanguageModelUsage, ModelMessage, StepResult, ToolSet } from "ai";

/**
 * Emitted when the model produces an assistant message.
 */
export interface AssistantMessageEvent {
  type: "assistant-message";
  message: string;
}

/**
 * Emitted when the model invokes a tool.
 */
export interface ToolCallEvent {
  type: "tool-call";
  toolName: string;
  input: unknown;
  toolCallId: string;
}

/**
 * Emitted when a tool execution completes.
 */
export interface ToolResultEvent {
  type: "tool-result";
  toolName: string;
  output: unknown;
  toolCallId: string;
}

/**
 * Emitted during streaming mode — incremental text token.
 */
export interface TextDeltaEvent {
  type: "text-delta";
  delta: string;
}

/**
 * Emitted after each agent step completes.
 */
export interface StepCompleteEvent {
  type: "step-complete";
  step: StepResult<ToolSet> | Record<string, unknown>;
  stepIndex: number;
}

/**
 * Emitted when an error occurs.
 */
export interface ErrorEvent {
  type: "error";
  error: Error;
}

/**
 * Emitted when the agent loop finishes.
 */
export interface DoneEvent {
  type: "done";
  text: string;
  steps: number;
  messages: ModelMessage[];
  usage: LanguageModelUsage;
}

/**
 * Discriminated union of all agent events.
 */
export type AgentEvent =
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | TextDeltaEvent
  | StepCompleteEvent
  | ErrorEvent
  | DoneEvent;
