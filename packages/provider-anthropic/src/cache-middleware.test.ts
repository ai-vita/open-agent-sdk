import { describe, it, expect } from "vitest";
import { anthropicPromptCacheMiddleware } from "./cache-middleware.js";

type MessageContent = Array<{ type: string; text?: string; providerOptions?: Record<string, unknown> }>;

function makeMessage(role: string, text = "content") {
  return {
    role,
    content: [{ type: "text", text }] as MessageContent,
  };
}

async function transformMessages(messages: Array<{ role: string; content: MessageContent }>) {
  const result = await anthropicPromptCacheMiddleware.transformParams!({
    params: { prompt: messages } as never,
    type: "generate",
    model: {} as never,
  });
  return (result as { prompt: typeof messages }).prompt;
}

describe("anthropicPromptCacheMiddleware", () => {
  it("has specificationVersion v3", () => {
    expect(anthropicPromptCacheMiddleware.specificationVersion).toBe("v3");
  });

  it("adds cache marker to the last message", async () => {
    const messages = [makeMessage("user", "hello")];
    const transformed = await transformMessages(messages);
    const lastContent = transformed[0].content.at(-1) as { providerOptions?: Record<string, unknown> };
    expect(lastContent.providerOptions?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } });
  });

  it("adds cache marker to last non-assistant message before the last message", async () => {
    const messages = [
      makeMessage("user", "first"),
      makeMessage("assistant", "reply"),
      makeMessage("user", "second"),
    ];
    const transformed = await transformMessages(messages);

    // Last message (user "second") should be marked
    const lastContent = transformed[2].content.at(-1) as { providerOptions?: Record<string, unknown> };
    expect(lastContent.providerOptions?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } });

    // Second non-assistant (user "first") should also be marked
    const firstContent = transformed[0].content.at(-1) as { providerOptions?: Record<string, unknown> };
    expect(firstContent.providerOptions?.anthropic).toEqual({ cacheControl: { type: "ephemeral" } });
  });

  it("handles empty message array without error", async () => {
    const messages: Array<{ role: string; content: MessageContent }> = [];
    await expect(transformMessages(messages)).resolves.not.toThrow();
  });

  it("does not throw on messages with string content", async () => {
    const messages = [{ role: "user", content: "plain string" as unknown as MessageContent }];
    await expect(transformMessages(messages)).resolves.not.toThrow();
  });
});
