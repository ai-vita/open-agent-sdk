import { asSchema } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createParallelMcpTools } from "./parallel-mcp.js";

const input = { objective: "docs", search_queries: ["SDK docs"] };
const options = { toolCallId: "test", messages: [] };

function stalledFetch() {
  return vi.fn<typeof globalThis.fetch>(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        if (init?.signal?.aborted) reject(init.signal.reason);
      }),
  );
}

function protocolFetch(callResult: unknown, stall?: string) {
  return vi.fn<typeof globalThis.fetch>(async (url, init) => {
    const message = JSON.parse(String(init?.body ?? "{}"));
    if (message.method === stall) return stalledFetch()(url, init);
    if (!("id" in message)) return new Response(null, { status: 202 });
    const result =
      message.method === "initialize"
        ? {
            protocolVersion: "2025-03-26",
            serverInfo: { name: "fixture", version: "1" },
            capabilities: { tools: {} },
          }
        : message.method === "tools/list"
          ? {
              tools: ["web_search", "web_fetch"].map((name) => ({
                name,
                inputSchema: { type: "object" },
              })),
            }
          : callResult;
    return Response.json({ jsonrpc: "2.0", id: message.id, result });
  });
}

describe("Parallel MCP failure handling", () => {
  it.each(["tools/list", "tools/call"])("applies the deadline during %s", async (method) => {
    const tools = createParallelMcpTools({ timeout: 30, fetch: protocolFetch({}, method) });
    await expect(tools.WebSearch.execute?.(input, options)).resolves.toEqual({
      error: "Parallel MCP timed out after 30ms",
    });
  });

  it("preserves service tool errors and rejects malformed tool results", async () => {
    const error = { content: [{ type: "text", text: "No content found" }], isError: true };
    const tools = createParallelMcpTools({ fetch: protocolFetch(error) });
    await expect(tools.WebSearch.execute?.(input, options)).resolves.toMatchObject(error);
    const malformed = createParallelMcpTools({ fetch: protocolFetch({ content: "invalid" }) });
    await expect(malformed.WebSearch.execute?.(input, options)).resolves.toMatchObject({
      error: expect.any(String),
    });
  });

  it("validates fetch URLs and objective limits before model dispatch", async () => {
    const tools = createParallelMcpTools();
    const schema = asSchema(tools.WebFetch.inputSchema);
    expect((await schema.validate?.({ urls: ["file:///etc/passwd"] }))?.success).toBe(false);
    expect(
      (await schema.validate?.({ urls: ["https://example.com"], objective: "x".repeat(201) }))
        ?.success,
    ).toBe(false);
    expect((await schema.validate?.({ urls: ["https://example.com"] }))?.success).toBe(true);
  });
  it("bounds the entire HTTP operation, including initialization", async () => {
    const tools = createParallelMcpTools({ timeout: 20, fetch: stalledFetch() });
    await expect(tools.WebSearch.execute?.(input, options)).resolves.toEqual({
      error: "Parallel MCP timed out after 20ms",
    });
  });

  it("propagates cancellation to HTTP and does not report it as a service result", async () => {
    const controller = new AbortController();
    const fetch = stalledFetch();
    const tools = createParallelMcpTools({ fetch });
    const result = tools.WebSearch.execute?.(input, { ...options, abortSignal: controller.signal });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    controller.abort(new Error("user cancelled"));
    await expect(result).rejects.toThrow("user cancelled");
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("does not contact the service for an already cancelled operation", async () => {
    const fetch = stalledFetch();
    const tools = createParallelMcpTools({ fetch });
    await expect(
      tools.WebSearch.execute?.(input, {
        ...options,
        abortSignal: AbortSignal.abort(new Error("cancelled")),
      }),
    ).rejects.toThrow("cancelled");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])("returns HTTP %i errors without switching providers", async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response("service failure", { status }),
    );
    const tools = createParallelMcpTools({ fetch });
    await expect(tools.WebSearch.execute?.(input, options)).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports malformed responses and rejects invalid deadlines", async () => {
    const tools = createParallelMcpTools({
      fetch: async () =>
        new Response("not JSON", { headers: { "content-type": "application/json" } }),
    });
    await expect(tools.WebSearch.execute?.(input, options)).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(() => createParallelMcpTools({ timeout: 0 })).toThrow("positive");
  });
});
