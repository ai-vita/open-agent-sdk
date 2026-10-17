import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { tool, zodSchema } from "ai";
import { z } from "zod";

export const PARALLEL_MCP_URL = "https://search.parallel.ai/mcp";
export const PARALLEL_MCP_USER_AGENT =
  "open-agent-sdk/0.1.0 (+https://github.com/ai-vita/open-agent-sdk)";

export interface ParallelMcpConfig {
  /** Total deadline for discovery and execution, in milliseconds (default: 30 seconds). */
  timeout?: number;
  /** Reuse the same identifier across search and fetch in one conversation. */
  sessionId?: string;
  /** Trusted runtime model identifier, used for service analytics. */
  modelName?: string;
  /** Custom HTTP implementation, for example to use an application proxy. */
  fetch?: typeof globalThis.fetch;
}

const searchSchema = z.object({
  objective: z.string().min(1).describe("The information to find"),
  search_queries: z.array(z.string().min(1)).min(1).describe("Related keyword queries"),
});
const fetchSchema = z.object({
  urls: z
    .array(
      z
        .string()
        .url()
        .refine((url) => /^https?:\/\//i.test(url)),
    )
    .min(1)
    .max(20),
  objective: z.string().max(200).optional(),
  search_queries: z.array(z.string()).optional(),
  full_content: z.boolean().default(false),
});

/** Anonymous Streamable HTTP MCP tools. Creating tools does not make a network request. */
export function createParallelMcpTools(config: ParallelMcpConfig = {}) {
  const sessionId = config.sessionId ?? randomUUID();
  const timeout = config.timeout ?? 30_000;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("MCP timeout must be positive");

  async function execute(
    name: "web_search" | "web_fetch",
    input: Record<string, unknown>,
    abortSignal?: AbortSignal,
  ) {
    abortSignal?.throwIfAborted();
    const deadline = AbortSignal.timeout(timeout);
    const signal = abortSignal ? AbortSignal.any([abortSignal, deadline]) : deadline;
    const client = new Client({ name: "open-agent-sdk", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(PARALLEL_MCP_URL), {
      requestInit: { headers: { "User-Agent": PARALLEL_MCP_USER_AGENT } },
      fetch: (url, init) =>
        (config.fetch ?? globalThis.fetch)(url, {
          ...init,
          signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
        }),
    });
    try {
      await client.connect(transport, { signal, timeout });
      const { tools } = await client.listTools(undefined, { signal, timeout });
      if (!tools.some((t) => t.name === name)) throw new Error(`MCP tool unavailable: ${name}`);
      return await client.callTool(
        {
          name,
          arguments: {
            ...input,
            session_id: sessionId,
            ...(config.modelName && { model_name: config.modelName }),
          },
        },
        undefined,
        { signal, timeout },
      );
    } catch (error) {
      // Cancellation remains cancellation; service and deadline errors are visible to the model.
      abortSignal?.throwIfAborted();
      return {
        error: deadline.aborted
          ? `Parallel MCP timed out after ${timeout}ms`
          : error instanceof Error
            ? error.message
            : "Parallel MCP request failed",
      };
    } finally {
      await client.close();
    }
  }

  return {
    WebSearch: tool({
      description:
        "Search the web for current information. Include relevant source URLs in your answer.",
      inputSchema: zodSchema(searchSchema),
      execute: (input, { abortSignal }) => execute("web_search", input, abortSignal),
    }),
    WebFetch: tool({
      description: "Read HTTP or HTTPS pages. Prefer excerpts unless full content is needed.",
      inputSchema: zodSchema(fetchSchema),
      execute: (input, { abortSignal }) => execute("web_fetch", input, abortSignal),
    }),
  };
}
