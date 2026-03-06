import {
  generateText,
  streamText,
  stepCountIs,
  type LanguageModel,
  type StepResult,
  type StopCondition,
  type ToolSet,
  type UIMessageStreamWriter,
  tool,
  zodSchema,
} from "ai";
import { z } from "zod";

export interface TaskOutput {
  result: string;
  usage?: { input_tokens: number; output_tokens: number };
  duration_ms?: number;
  subagent?: string;
  description?: string;
}

export interface TaskError {
  error: string;
  subagent?: string;
  description?: string;
  duration_ms?: number;
}

/** Event emitted for each step a subagent takes */
export interface SubagentStepEvent {
  subagentType: string;
  description: string;
  step: StepResult<ToolSet>;
}

/** Data streamed to UI for subagent events */
export interface SubagentEventData {
  event: "start" | "tool-call" | "done" | "complete";
  subagent: string;
  description: string;
  toolName?: string;
  args?: Record<string, unknown>;
}

/** Configuration for a predefined subagent type */
export interface SubagentTypeConfig {
  model?: LanguageModel;
  systemPrompt?: string;
  /** Tool names this subagent can use (filters from parent tools) */
  tools?: string[];
  additionalTools?: ToolSet;
  stopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
  onStepFinish?: (step: StepResult<ToolSet>) => void | Promise<void>;
}

export interface TaskToolConfig {
  /** Default model for subagents */
  model: LanguageModel;
  /** All available tools subagents can draw from */
  tools: ToolSet;
  /** Predefined subagent type configurations */
  subagentTypes?: Record<string, SubagentTypeConfig>;
  /** Default stop condition(s) (default: stepCountIs(15)) */
  defaultStopWhen?: StopCondition<ToolSet> | StopCondition<ToolSet>[];
  /** Default step callback */
  defaultOnStepFinish?: (event: SubagentStepEvent) => void | Promise<void>;
  /** Optional stream writer for real-time events */
  streamWriter?: UIMessageStreamWriter;
}

const taskInputSchema = z.object({
  description: z.string().describe("A short (3-5 word) description of the task"),
  prompt: z.string().describe("The task for the agent to perform"),
  subagent_type: z.string().describe("The type of specialized agent to use"),
  system_prompt: z
    .string()
    .nullable()
    .default(null)
    .describe("Custom system prompt override for this subagent"),
  tools: z
    .array(z.string())
    .nullable()
    .default(null)
    .describe("Tool names this agent can use (overrides subagent type defaults)"),
});

type TaskInput = z.infer<typeof taskInputSchema>;

const TASK_DESCRIPTION = `Launch a specialized sub-agent to handle a complex task autonomously.

Each sub-agent has its own context and tool set. Launch multiple agents concurrently for parallel work.

When the agent completes, send the user a concise summary of the result.
Provide clear, detailed prompts so the agent can work autonomously.`;

let eventCounter = 0;
function genId() {
  return `subagent-${Date.now()}-${++eventCounter}`;
}

function filterTools(
  allTools: ToolSet,
  allowedTools?: string[],
  additionalTools?: ToolSet,
): ToolSet {
  let result: ToolSet = allowedTools
    ? Object.fromEntries(
        allowedTools.filter((n) => allTools[n]).map((n) => [n, allTools[n]]),
      )
    : { ...allTools };

  if (additionalTools) result = { ...result, ...additionalTools };
  return result;
}

export function createTaskTool(config: TaskToolConfig) {
  const {
    model: defaultModel,
    tools: allTools,
    subagentTypes = {},
    defaultStopWhen,
    defaultOnStepFinish,
    streamWriter,
  } = config;

  return tool({
    description: TASK_DESCRIPTION,
    inputSchema: zodSchema(taskInputSchema),
    execute: async ({
      description,
      prompt,
      subagent_type,
      system_prompt,
      tools: customTools,
    }: TaskInput): Promise<TaskOutput | TaskError> => {
      const startTime = performance.now();
      const typeConfig = subagentTypes[subagent_type] ?? {};

      try {
        const model = typeConfig.model ?? defaultModel;
        const tools = filterTools(
          allTools,
          customTools ?? typeConfig.tools,
          typeConfig.additionalTools,
        );
        const systemPrompt = system_prompt ?? typeConfig.systemPrompt;

        const baseStop = typeConfig.stopWhen ?? defaultStopWhen ?? stepCountIs(15);
        const stopWhen = Array.isArray(baseStop) ? baseStop : [baseStop];

        const commonOpts = {
          model,
          tools,
          system: systemPrompt,
          prompt,
          stopWhen,
        };

        if (streamWriter) {
          // Streaming mode: emit events for UI
          streamWriter.write({
            type: "data-subagent",
            id: genId(),
            data: { event: "start", subagent: subagent_type, description } as SubagentEventData,
          });

          const result = streamText({
            ...commonOpts,
            onStepFinish: async (step) => {
              if (step.toolCalls?.length) {
                for (const tc of step.toolCalls) {
                  streamWriter.write({
                    type: "data-subagent",
                    id: genId(),
                    data: {
                      event: "tool-call",
                      subagent: subagent_type,
                      description,
                      toolName: tc.toolName,
                      args: tc.input as Record<string, unknown>,
                    } as SubagentEventData,
                  });
                }
              }
              await typeConfig.onStepFinish?.(step);
              await defaultOnStepFinish?.({ subagentType: subagent_type, description, step });
            },
          });

          const text = await result.text;
          const usage = await result.usage;

          streamWriter.write({
            type: "data-subagent",
            id: genId(),
            data: { event: "done", subagent: subagent_type, description } as SubagentEventData,
          });

          return {
            result: text,
            usage:
              usage.inputTokens !== undefined
                ? { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens ?? 0 }
                : undefined,
            duration_ms: Math.round(performance.now() - startTime),
            subagent: subagent_type,
            description,
          };
        }

        // Non-streaming mode
        const result = await generateText({
          ...commonOpts,
          onStepFinish: async (step) => {
            await typeConfig.onStepFinish?.(step);
            await defaultOnStepFinish?.({ subagentType: subagent_type, description, step });
          },
        });

        return {
          result: result.text,
          usage:
            result.usage.inputTokens !== undefined
              ? { input_tokens: result.usage.inputTokens, output_tokens: result.usage.outputTokens ?? 0 }
              : undefined,
          duration_ms: Math.round(performance.now() - startTime),
          subagent: subagent_type,
          description,
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : "Unknown error",
          subagent: subagent_type,
          description,
          duration_ms: Math.round(performance.now() - startTime),
        };
      }
    },
  });
}
