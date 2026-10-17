import {
  createParallelMcpTools,
  createWebFetchTool,
  createWebSearchTool,
  type ParallelMcpConfig,
} from "@open-agent-sdk/tools-web";
import type { ToolSet } from "ai";

export type WebProvider = "mcp" | "parallel" | "off";

/** Shell/config-file credentials are resolved by the CLI before this function is called. */
export function createCliWebTools(
  options: { provider?: WebProvider; apiKey?: string; mcp?: ParallelMcpConfig } = {},
): ToolSet {
  const provider = options.provider ?? (options.apiKey ? "parallel" : "mcp");
  if (provider === "off") return {};
  if (provider === "mcp") return createParallelMcpTools(options.mcp);
  if (provider !== "parallel") throw new Error(`Unknown web provider: ${provider}`);
  if (!options.apiKey) throw new Error("--web parallel requires PARALLEL_API_KEY");
  return {
    WebSearch: createWebSearchTool({ apiKey: options.apiKey }),
    WebFetch: createWebFetchTool({ apiKey: options.apiKey }),
  };
}
