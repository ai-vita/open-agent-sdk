import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";
import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface GlobOutput {
  matches: string[];
  count: number;
  search_path: string;
}

export interface GlobError {
  error: string;
}

const globInputSchema = z.object({
  pattern: z
    .string()
    .describe('Glob pattern to match files (e.g., "**/*.ts", "src/**/*.js", "*.md")'),
  path: z
    .string()
    .nullable()
    .default(null)
    .describe("Directory to search in (defaults to working directory)"),
});

type GlobInput = z.infer<typeof globInputSchema>;

const GLOB_DESCRIPTION = `Fast file pattern matching tool.

- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths
- Use when you need to find files by name pattern`;

export function createGlobTool(sandbox: Sandbox, config?: ToolConfig) {
  return tool({
    description: GLOB_DESCRIPTION,
    inputSchema: zodSchema(globInputSchema),
    strict: config?.strict,
    needsApproval: config?.needsApproval,
    providerOptions: config?.providerOptions,
    execute: async ({ pattern, path }: GlobInput): Promise<GlobOutput | GlobError> => {
      const searchPath = path ?? ".";

      if (config?.allowedPaths) {
        const allowed = config.allowedPaths.some((p) => searchPath.startsWith(p));
        if (!allowed) return { error: `Path not allowed: ${searchPath}` };
      }

      try {
        const findFlag = pattern.includes("/") ? "-path" : "-name";
        const findPattern =
          pattern.includes("/") && !pattern.startsWith("*") ? `*/${pattern}` : pattern;

        const result = await sandbox.exec(
          `find ${searchPath} -type f ${findFlag} "${findPattern}" 2>/dev/null | head -1000`,
          { timeout: config?.timeout },
        );

        if (result.exitCode !== 0 && result.stderr) {
          return { error: result.stderr };
        }

        const matches = result.stdout
          .split("\n")
          .filter(Boolean)
          .map((p) => p.trim());

        return { matches, count: matches.length, search_path: searchPath };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
