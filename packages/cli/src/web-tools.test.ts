import { Agent } from "@open-agent-sdk/core";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCliWebTools } from "./web-tools.js";

const callOptions = { toolCallId: "test", messages: [] };
const searchInput = { objective: "Find SDK docs", search_queries: ["SDK docs"] };
const sourceUrl = "https://example.com/docs";

function fixture() {
  const requests: { url: string; headers: Headers; body: Record<string, any> }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    requests.push({ url: String(url), headers: new Headers(init?.headers), body });
    if (!("id" in body)) return new Response(null, { status: 202 });
    const result =
      body.method === "initialize"
        ? {
            protocolVersion: "2025-03-26",
            serverInfo: { name: "fixture", version: "1" },
            capabilities: { tools: {} },
          }
        : body.method === "tools/list"
          ? {
              tools: ["web_search", "web_fetch"].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
            }
          : {
              content: [
                {
                  type: "text",
                  text:
                    body.params.name === "web_search"
                      ? `SDK documentation: ${sourceUrl}`
                      : "The SDK supports agents and tools.",
                },
              ],
            };
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  });
  return { fetch, requests };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("CLI web tools", () => {
  it("defaults to anonymous MCP, preserves URLs, and sends the project User-Agent on every request", async () => {
    const f = fixture();
    const tools = createCliWebTools({
      mcp: { fetch: f.fetch, sessionId: "conversation-123456789012345678901234567890" },
    });
    expect(f.fetch).not.toHaveBeenCalled();
    const result = await tools.WebSearch.execute?.(searchInput, callOptions);
    expect(result).toMatchObject({ content: [{ text: expect.stringContaining(sourceUrl) }] });
    await tools.WebFetch.execute?.({ urls: [sourceUrl], full_content: false }, callOptions);
    for (const r of f.requests) {
      expect(r.url).toBe("https://search.parallel.ai/mcp");
      expect(r.headers.get("user-agent")).toBe(
        "open-agent-sdk/0.1.0 (+https://github.com/ai-vita/open-agent-sdk)",
      );
      expect(r.headers.has("authorization")).toBe(false);
    }
    const calls = f.requests.filter((r) => r.body.method === "tools/call");
    expect(calls.map((r) => r.body.params.name)).toEqual(["web_search", "web_fetch"]);
    expect(calls[0].body.params.arguments).toMatchObject(searchInput);
    expect(calls[1].body.params.arguments.urls).toEqual([sourceUrl]);
    expect(calls[0].body.params.arguments.session_id).toBe(
      calls[1].body.params.arguments.session_id,
    );
  });

  it("preserves configured API credentials and domain filters without falling back after an API failure", async () => {
    const f = fixture();
    const apiFetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ error: { message: "invalid API key" } }, { status: 401 }),
    );
    vi.stubGlobal("fetch", apiFetch);
    const tools = createCliWebTools({ apiKey: "saved-key", mcp: { fetch: f.fetch } });
    const result = await tools.WebSearch.execute?.(
      { query: "docs", allowed_domains: ["example.com"], blocked_domains: null },
      callOptions,
    );
    expect(result).toMatchObject({ error: expect.stringContaining("invalid API key") });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [url, init] = apiFetch.mock.calls[0];
    expect(String(url)).toContain("api.parallel.ai");
    expect(new Headers(init?.headers).get("x-api-key")).toBe("saved-key");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      source_policy: { include_domains: ["example.com"] },
    });
    expect(f.fetch).not.toHaveBeenCalled();
  });

  it("honors explicit anonymous selection even with a saved API key", async () => {
    const f = fixture();
    const tools = createCliWebTools({
      provider: "mcp",
      apiKey: "saved-key",
      mcp: { fetch: f.fetch },
    });
    await tools.WebSearch.execute?.(searchInput, callOptions);
    expect(f.fetch).toHaveBeenCalled();
    expect(f.requests.every((r) => !r.headers.has("authorization"))).toBe(true);
  });

  it("disables both tools and rejects an explicitly selected API provider without credentials", () => {
    expect(createCliWebTools({ provider: "off", apiKey: "saved-key" })).toEqual({});
    expect(() => createCliWebTools({ provider: "parallel" })).toThrow("requires PARALLEL_API_KEY");
  });

  it.each([
    "generate",
    "stream",
  ] as const)("consumes search and fetched content through Agent.%s with a scripted model", async (mode) => {
    const f = fixture();
    let step = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async ({ prompt }) => {
        const result = {
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
        };
        if (step++ === 0)
          return {
            ...result,
            finishReason: { unified: "tool-calls", raw: undefined },
            content: [
              {
                type: "tool-call",
                toolCallId: "search",
                toolName: "WebSearch",
                input: JSON.stringify(searchInput),
              },
            ],
          };
        if (step === 2) {
          expect(JSON.stringify(prompt)).toContain(sourceUrl);
          return {
            ...result,
            finishReason: { unified: "tool-calls", raw: undefined },
            content: [
              {
                type: "tool-call",
                toolCallId: "fetch",
                toolName: "WebFetch",
                input: JSON.stringify({ urls: [sourceUrl] }),
              },
            ],
          };
        }
        expect(JSON.stringify(prompt)).toContain("The SDK supports agents and tools.");
        return {
          ...result,
          finishReason: { unified: "stop", raw: undefined },
          content: [
            { type: "text", text: `The SDK supports agents and tools. Source: ${sourceUrl}` },
          ],
        };
      },
    });
    model.doStream = async (options) => {
      const result = await model.doGenerate(options);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            for (const part of result.content) {
              if (part.type === "tool-call") controller.enqueue(part);
              if (part.type === "text") {
                controller.enqueue({ type: "text-start", id: "answer" });
                controller.enqueue({ type: "text-delta", id: "answer", delta: part.text });
                controller.enqueue({ type: "text-end", id: "answer" });
              }
            }
            controller.enqueue({
              type: "finish",
              finishReason: result.finishReason,
              usage: result.usage,
            });
            controller.close();
          },
        }),
      };
    };
    const agent = new Agent({
      model,
      tools: createCliWebTools({ mcp: { fetch: f.fetch } }),
      maxSteps: 4,
    });
    const events = [];
    if (mode === "generate") {
      events.push(...(await agent.generate("Look up the current SDK docs and read the page.")));
    } else {
      for await (const event of agent.stream("Look up the current SDK docs and read the page."))
        events.push(event);
    }
    expect(events.filter((event) => event.type === "tool-result")).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ type: "done", text: expect.stringContaining(sourceUrl) });
    expect(f.requests.filter((r) => r.body.method === "tools/call")).toHaveLength(2);
  });
});
