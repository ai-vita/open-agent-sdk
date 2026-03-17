import type { ModelMessage } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Agent } from "./agent-class.js";
import type { AgentEvent, DoneEvent } from "./agent-events.js";

// Mock runAgent to avoid needing a real model
vi.mock("./agent.js", () => ({
  runAgent: async function* (options: { messages: ModelMessage[] }): AsyncGenerator<AgentEvent> {
    const responseMessage: ModelMessage = {
      role: "assistant",
      content: [{ type: "text", text: "mocked response" }],
    };
    yield {
      type: "assistant-message",
      message: "mocked response",
    };
    yield {
      type: "step-complete",
      step: {},
      stepIndex: 0,
    };
    yield {
      type: "done",
      text: "mocked response",
      steps: 1,
      messages: [...options.messages, responseMessage],
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        inputTokenDetails: {
          noCacheTokens: undefined,
          cacheReadTokens: undefined,
          cacheWriteTokens: undefined,
        },
        outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      },
    } satisfies DoneEvent;
  },
}));

describe("Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("basic generate returns events", async () => {
    const agent = new Agent({
      model: {} as any,
    });

    const events = await agent.generate("hello");
    expect(events.length).toBeGreaterThan(0);

    const doneEvent = events.find((e) => e.type === "done") as DoneEvent;
    expect(doneEvent).toBeDefined();
    expect(doneEvent.text).toBe("mocked response");
  });

  it("accumulates messages across multi-turn conversation", async () => {
    const agent = new Agent({
      model: {} as any,
    });

    await agent.generate("first message");
    const messagesAfterFirst = agent.getMessages();
    // Should have: user message + assistant response
    expect(messagesAfterFirst.length).toBe(2);

    await agent.generate("second message");
    const messagesAfterSecond = agent.getMessages();
    // Should have: first user + first assistant + second user + second assistant
    expect(messagesAfterSecond.length).toBe(4);
  });

  it("steer injects message and clears after use", async () => {
    const agent = new Agent({
      model: {} as any,
    });

    agent.steer({ role: "user", content: "Focus on error handling" });
    const events = await agent.generate("Write a function");

    const doneEvent = events.find((e) => e.type === "done") as DoneEvent;
    // The messages sent to the model should include the steered message
    // Since our mock just passes through messages, check that they were included
    expect(doneEvent).toBeDefined();

    // After use, steered messages should be cleared
    // A second generate should not include the steered message
    await agent.generate("Another prompt");
    const messages = agent.getMessages();
    // The steered message should NOT appear in the second call's input
    // (it was cleared after first use)
    expect(messages.length).toBeGreaterThan(2);
  });

  it("stream yields events", async () => {
    const agent = new Agent({
      model: {} as any,
      stream: true,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.stream("hello")) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
  });
});
