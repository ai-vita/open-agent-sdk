import type { LanguageModelMiddleware } from "ai";

type Message = {
  role: string;
  content: unknown;
};

function addCacheMarker(message: Message | undefined): void {
  if (!message || !message.content || !Array.isArray(message.content)) return;

  const lastPart = message.content.at(-1);
  if (!lastPart || typeof lastPart === "string") return;

  (lastPart as { providerOptions?: Record<string, unknown> }).providerOptions = {
    ...(lastPart as { providerOptions?: Record<string, unknown> }).providerOptions,
    anthropic: {
      cacheControl: { type: "ephemeral" },
    },
  };
}

function applyCacheMarkers<T extends { prompt: Message[] }>(params: T): T {
  const messages = params.prompt;
  if (!messages || messages.length === 0) return params;

  // Mark the last message
  addCacheMarker(messages.at(-1));

  // Mark the last non-assistant message (excluding the last message)
  addCacheMarker(
    [...messages.slice(0, -1)].reverse().find((m: Message) => m.role !== "assistant"),
  );

  return params;
}

/**
 * Adds Anthropic prompt caching markers to system prompt and recent context.
 *
 * Compatible with AI SDK v6+ `wrapLanguageModel`.
 *
 * @example
 * ```typescript
 * import { wrapLanguageModel } from "ai";
 * import { anthropic } from "@ai-sdk/anthropic";
 * import { anthropicPromptCacheMiddleware } from "@open-agent-sdk/provider-anthropic";
 *
 * const model = wrapLanguageModel({
 *   model: anthropic("claude-sonnet-4-20250514"),
 *   middleware: anthropicPromptCacheMiddleware,
 * });
 * ```
 */
export const anthropicPromptCacheMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  transformParams: async ({ params }) =>
    applyCacheMarkers(params as { prompt: Message[] }) as typeof params,
};
