import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  type StepResult,
  type StopCondition,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import type { AgentEvent } from "./agent-events.js";

/**
 * Stop condition function: receives the accumulated steps.
 * Return true to halt the agent loop.
 */
export type StopWhen = StopCondition<ToolSet>;

/**
 * Options for the runAgent() function.
 */
export interface AgentOptions {
  /** Language model to use (any Vercel AI SDK provider) */
  model: LanguageModel;
  /** Tool set to make available to the agent */
  tools?: ToolSet;
  /** System prompt */
  system?: string;
  /** Initial message or message array */
  messages?: ModelMessage[] | string;
  /** Stop condition(s) — stops when ANY condition is met */
  stopWhen?: StopWhen | StopWhen[];
  /** Enable streaming text deltas (default: false) */
  stream?: boolean;
  /** Maximum number of steps (default: 20) */
  maxSteps?: number;
  /** Callback after each step */
  onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}

/**
 * Runs an AI agent as an async generator, yielding events as the agent acts.
 *
 * @example
 * ```typescript
 * for await (const event of runAgent({ model, tools, system, messages: "Hello!" })) {
 *   if (event.type === "done") console.log(event.text);
 * }
 * ```
 */
export async function* runAgent(options: AgentOptions): AsyncGenerator<AgentEvent> {
  const {
    model,
    tools,
    system,
    messages: rawMessages,
    stopWhen,
    stream = false,
    maxSteps = 20,
    onStepFinish,
  } = options;

  const messages = normalizeMessages(rawMessages);
  const stopConditions = buildStopCondition(stopWhen, maxSteps);

  if (stream) {
    yield* runStreaming({ model, tools, system, messages, stopConditions, onStepFinish });
  } else {
    yield* runNonStreaming({ model, tools, system, messages, stopConditions, onStepFinish });
  }
}

// ---------------------------------------------------------------------------
// Non-streaming implementation
// ---------------------------------------------------------------------------

async function* runNonStreaming(opts: {
  model: LanguageModel;
  tools?: ToolSet;
  system?: string;
  messages: ModelMessage[];
  stopConditions: StopWhen | StopWhen[];
  onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}): AsyncGenerator<AgentEvent> {
  const collectedStepEvents: AgentEvent[][] = [];
  let stepIndex = 0;

  const result = await generateText({
    model: opts.model,
    tools: opts.tools,
    system: opts.system,
    messages: opts.messages,
    stopWhen: opts.stopConditions,
    onStepFinish: async (step) => {
      const idx = stepIndex++;
      collectedStepEvents.push(collectStepEvents(step, idx));
      await opts.onStepFinish?.(step);
    },
  });

  // Yield step events in order
  for (const events of collectedStepEvents) {
    for (const event of events) {
      yield event;
    }
  }

  yield {
    type: "done",
    text: result.text,
    steps: stepIndex,
    messages: [...opts.messages, ...(result.response.messages as ModelMessage[])],
    usage: result.totalUsage,
  };
}

// ---------------------------------------------------------------------------
// Streaming implementation
// ---------------------------------------------------------------------------

async function* runStreaming(opts: {
  model: LanguageModel;
  tools?: ToolSet;
  system?: string;
  messages: ModelMessage[];
  stopConditions: StopWhen | StopWhen[];
  onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}): AsyncGenerator<AgentEvent> {
  let stepIndex = 0;
  let fullText = "";

  const result = streamText({
    model: opts.model,
    tools: opts.tools,
    system: opts.system,
    messages: opts.messages,
    stopWhen: opts.stopConditions,
    onStepFinish: opts.onStepFinish,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        fullText += part.text;
        yield { type: "text-delta", delta: part.text };
        break;
      case "tool-call":
        yield {
          type: "tool-call",
          toolName: part.toolName,
          input: part.input,
          toolCallId: part.toolCallId,
        };
        break;
      case "tool-result":
        yield {
          type: "tool-result",
          toolName: part.toolName,
          output: part.output,
          toolCallId: part.toolCallId,
        };
        break;
      case "finish-step":
        yield { type: "step-complete", step: part, stepIndex: stepIndex++ };
        break;
      case "error":
        yield {
          type: "error",
          error: part.error instanceof Error ? part.error : new Error(String(part.error)),
        };
        break;
    }
  }

  const response = await result.response;
  const usage = await result.totalUsage;
  yield {
    type: "done",
    text: fullText,
    steps: stepIndex,
    messages: [...opts.messages, ...(response.messages as ModelMessage[])],
    usage,
  };
}

// ---------------------------------------------------------------------------
// Stop conditions
// ---------------------------------------------------------------------------

/**
 * Stop after N steps.
 */
export { stepCountIs };

/**
 * Stop when a budget tracker signals exceeded.
 */
export function budgetExceeded(isExceeded: () => boolean): StopWhen {
  return () => isExceeded();
}

/**
 * Compose multiple stop conditions — stops when ANY is satisfied.
 */
export function composeStops(...conditions: StopWhen[]): StopWhen {
  return (opts) => conditions.some((c) => c(opts));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeMessages(raw?: ModelMessage[] | string): ModelMessage[] {
  if (!raw) return [];
  if (typeof raw === "string") return [{ role: "user", content: raw }];
  return raw;
}

function buildStopCondition(
  stopWhen: StopWhen | StopWhen[] | undefined,
  maxSteps: number,
): StopWhen | StopWhen[] {
  const defaultStop = stepCountIs(maxSteps);
  if (!stopWhen) return defaultStop;
  const conditions = Array.isArray(stopWhen) ? stopWhen : [stopWhen];
  return [defaultStop, ...conditions];
}

function collectStepEvents(step: StepResult<ToolSet>, stepIndex: number): AgentEvent[] {
  const events: AgentEvent[] = [];

  if (step.text) {
    events.push({ type: "assistant-message", message: step.text });
  }

  for (const tc of step.toolCalls ?? []) {
    events.push({
      type: "tool-call",
      toolName: tc.toolName,
      input: tc.input,
      toolCallId: tc.toolCallId,
    });
  }

  for (const tr of step.toolResults ?? []) {
    events.push({
      type: "tool-result",
      toolName: tr.toolName,
      output: tr.output,
      toolCallId: tr.toolCallId,
    });
  }

  events.push({ type: "step-complete", step, stepIndex });

  return events;
}
