import type { LanguageModel, ToolSet } from "ai";
import { jsonSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createTaskTool } from "./task.js";

function createMockModel(): LanguageModel {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock",
    doGenerate: vi.fn(async () => ({
      content: [{ type: "text", text: "Task completed", id: "text-1" }],
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: "stop",
      warnings: [],
    })),
    doStream: vi.fn(async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] });
          controller.enqueue({ type: "text-start", id: "text-1" });
          controller.enqueue({ type: "text-delta", id: "text-1", delta: "Task completed" });
          controller.enqueue({ type: "text-end", id: "text-1" });
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      }),
    })),
  } as unknown as LanguageModel;
}

const emptySchema = jsonSchema({ type: "object", properties: {}, additionalProperties: false });

describe("createTaskTool", () => {
  it("returns task result with usage", async () => {
    const model = createMockModel();
    const tools: ToolSet = {};
    const taskTool = createTaskTool({ model, tools });

    const result = await taskTool.execute?.(
      {
        description: "test task",
        prompt: "Do something",
        subagent_type: "general",
        system_prompt: null,
        tools: null,
      },
      undefined as never,
    );

    expect((result as { result: string }).result).toBeDefined();
    expect((result as { subagent: string }).subagent).toBe("general");
    expect((result as { description: string }).description).toBe("test task");
  });

  it("uses custom system prompt when provided", async () => {
    const model = createMockModel();
    const taskTool = createTaskTool({ model, tools: {} });

    const result = await taskTool.execute?.(
      {
        description: "test",
        prompt: "Do X",
        subagent_type: "general",
        system_prompt: "You are a custom agent",
        tools: null,
      },
      undefined as never,
    );

    expect((result as { error?: string }).error).toBeUndefined();
  });

  it("filters tools when tools list is provided", async () => {
    const model = createMockModel();
    const allTools: ToolSet = {
      Read: { description: "read", inputSchema: emptySchema, execute: vi.fn() },
      Write: { description: "write", inputSchema: emptySchema, execute: vi.fn() },
    };

    const taskTool = createTaskTool({
      model,
      tools: allTools,
      subagentTypes: {
        readonly: {
          systemPrompt: "Read-only agent",
          tools: ["Read"],
        },
      },
    });

    // This just checks the tool executes without error
    const result = await taskTool.execute?.(
      {
        description: "read task",
        prompt: "Read something",
        subagent_type: "readonly",
        system_prompt: null,
        tools: null,
      },
      undefined as never,
    );

    expect((result as { error?: string }).error).toBeUndefined();
  });

  it("calls defaultOnStepFinish for each step", async () => {
    const model = createMockModel();
    const onStepFinish = vi.fn();

    const taskTool = createTaskTool({ model, tools: {}, defaultOnStepFinish: onStepFinish });
    await taskTool.execute?.(
      { description: "t", prompt: "p", subagent_type: "g", system_prompt: null, tools: null },
      undefined as never,
    );

    // generateText with no tool calls = 1 step
    expect(onStepFinish).toHaveBeenCalled();
  });

  it("handles errors gracefully", async () => {
    const model = {
      ...(createMockModel() as Record<string, unknown>),
      doGenerate: vi.fn(async () => {
        throw new Error("Model error");
      }),
    } as unknown as LanguageModel;

    const taskTool = createTaskTool({ model, tools: {} });
    const result = await taskTool.execute?.(
      { description: "t", prompt: "p", subagent_type: "g", system_prompt: null, tools: null },
      undefined as never,
    );

    expect((result as { error: string }).error).toContain("Model error");
  });
});
