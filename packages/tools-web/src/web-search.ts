import { tool, zodSchema } from "ai";
import Parallel from "parallel-web";
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
  provider?: "parallel" | "you";
}

const webSearchSchema = z.object({
  query: z.string().describe("The search query"),
  allowed_domains: z
    .array(z.string())
    .nullable()
    .default(null)
    .describe("Only include results from these domains"),
  blocked_domains: z
    .array(z.string())
    .nullable()
    .default(null)
    .describe("Never include results from these domains"),
});

type WebSearchInput = z.infer<typeof webSearchSchema>;

const WEB_SEARCH_DESCRIPTION = `Search the web for current information.

After answering, include a "Sources:" section with relevant URLs.
Use the current year in queries for recent information.`;

async function searchWithParallel(
  apiKey: string,
  { query, allowed_domains, blocked_domains }: WebSearchInput,
): Promise<WebSearchOutput | WebSearchError> {
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

  const results: WebSearchResult[] = (
    (search.results || []) as { title?: string; url?: string; excerpts?: string[] }[]
  ).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.excerpts?.join("\n") ?? "",
  }));

  return { results, total_results: results.length, query };
}

async function searchWithYou(
  apiKey: string,
  { query, allowed_domains, blocked_domains }: WebSearchInput,
): Promise<WebSearchOutput | WebSearchError> {
  const domainFilters = [
    ...(allowed_domains ?? []).map((domain) => `site:${domain}`),
    ...(blocked_domains ?? []).map((domain) => `-site:${domain}`),
  ];
  const composedQuery = [query, ...domainFilters].join(" ").trim();

  const response = await fetch(
    `https://api.ydc-index.io/search?query=${encodeURIComponent(composedQuery)}&num_web_results=10`,
    {
      headers: {
        "X-API-Key": apiKey,
      },
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      error: `You.com API request failed (${response.status})${body ? `: ${body}` : ""}`,
    };
  }

  const payload = (await response.json()) as {
    hits?: { title?: string; url?: string; description?: string }[];
  };

  const results: WebSearchResult[] = (payload.hits ?? []).map((hit) => ({
    title: hit.title ?? "",
    url: hit.url ?? "",
    snippet: hit.description ?? "",
  }));

  return { results, total_results: results.length, query };
}

export async function webSearch(
  config: WebSearchConfig,
  input: WebSearchInput,
): Promise<WebSearchOutput | WebSearchError> {
  try {
    const provider = config.provider ?? "parallel";

    if (provider === "you") {
      return await searchWithYou(config.apiKey, input);
    }

    return await searchWithParallel(config.apiKey, input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function createWebSearchTool(config: WebSearchConfig) {
  return tool({
    description: WEB_SEARCH_DESCRIPTION,
    inputSchema: zodSchema(webSearchSchema),
    execute: (input) => webSearch(config, input),
  });
}
