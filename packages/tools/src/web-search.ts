import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutput {
  results: WebSearchResult[];
  total_results: number;
  query: string;
}

export interface WebSearchError {
  error: string;
}

export interface WebSearchConfig {
  apiKey: string;
  provider?: "parallel";
}

const webSearchSchema = z.object({
  query: z.string().describe("The search query"),
  allowed_domains: z.array(z.string()).nullable().default(null).describe("Only include results from these domains"),
  blocked_domains: z.array(z.string()).nullable().default(null).describe("Never include results from these domains"),
});

type WebSearchInput = z.infer<typeof webSearchSchema>;

let parallelModule: typeof import("parallel-web") | null = null;

async function getParallelModule() {
  if (!parallelModule) {
    try {
      parallelModule = await import("parallel-web");
    } catch {
      throw new Error("WebSearch requires parallel-web. Install with: npm install parallel-web");
    }
  }
  return parallelModule;
}

const WEB_SEARCH_DESCRIPTION = `Search the web for current information.

After answering, include a "Sources:" section with relevant URLs.
Use the current year in queries for recent information.`;

export function createWebSearchTool(config: WebSearchConfig) {
  const { apiKey } = config;

  return tool({
    description: WEB_SEARCH_DESCRIPTION,
    inputSchema: zodSchema(webSearchSchema),
    execute: async ({ query, allowed_domains, blocked_domains }: WebSearchInput): Promise<WebSearchOutput | WebSearchError> => {
      try {
        const { default: Parallel } = await getParallelModule();
        const client = new Parallel({ apiKey });

        const sourcePolicy =
          allowed_domains || blocked_domains
            ? {
                ...(allowed_domains && { include_domains: allowed_domains }),
                ...(blocked_domains && { exclude_domains: blocked_domains }),
              }
            : undefined;

        const search = await client.beta.search({
          mode: "agentic",
          objective: query,
          max_results: 10,
          ...(sourcePolicy && { source_policy: sourcePolicy }),
        });

        const results: WebSearchResult[] = ((search.results || []) as { title?: string; url?: string; excerpts?: string[] }[]).map((r) => ({
          title: r.title ?? "",
          url: r.url ?? "",
          snippet: r.excerpts?.join("\n") ?? "",
        }));

        return { results, total_results: results.length, query };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
