import { tool, zodSchema } from "ai";
import Parallel from "parallel-web";
import { z } from "zod";

export interface WebFetchOutput {
  response: string;
  url: string;
  final_url?: string;
}

export interface WebFetchError {
  error: string;
}

export interface WebFetchConfig {
  apiKey: string;
  provider?: "parallel";
}

const webFetchSchema = z.object({
  url: z.string().describe("The URL to fetch content from"),
  prompt: z.string().describe("What to extract or summarize from the page"),
});

type WebFetchInput = z.infer<typeof webFetchSchema>;

const WEB_FETCH_DESCRIPTION = `Fetch content from a URL and process it with an AI model.

- Fetches the URL content and extracts text
- Processes the content with the given prompt
- Returns the AI model's response`;

export async function webFetch(
  apiKey: string,
  { url, prompt }: WebFetchInput,
): Promise<WebFetchOutput | WebFetchError> {
  try {
    const client = new Parallel({ apiKey });

    const extract = await client.beta.extract({
      urls: [url],
      objective: prompt,
      excerpts: true,
      full_content: true,
    });

    if (!extract.results || extract.results.length === 0) {
      return { error: "No content extracted from URL" };
    }

    const result = extract.results[0] as {
      url?: string;
      full_content?: string;
      excerpts?: string[];
    };
    const content = result.full_content || result.excerpts?.join("\n\n") || "";

    if (!content) return { error: "No content available from URL" };

    return {
      response: content,
      url,
      final_url: result.url || url,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function createWebFetchTool(config: WebFetchConfig) {
  return tool({
    description: WEB_FETCH_DESCRIPTION,
    inputSchema: zodSchema(webFetchSchema),
    execute: (input) => webFetch(config.apiKey, input),
  });
}
