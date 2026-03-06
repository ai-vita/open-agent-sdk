import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";

export interface ReadTextOutput {
  type: "text";
  content: string;
  lines: Array<{ line_number: number; content: string }>;
  total_lines: number;
}

export interface ReadDirectoryOutput {
  type: "directory";
  entries: string[];
  count: number;
}

export interface ReadError {
  error: string;
}

export type ReadOutput = ReadTextOutput | ReadDirectoryOutput;

const readInputSchema = z.object({
  file_path: z.string().describe("Absolute path to file or directory"),
  offset: z
    .number()
    .nullable()
    .default(null)
    .describe("Line number to start reading from (1-indexed)"),
  limit: z
    .number()
    .nullable()
    .default(null)
    .describe("Maximum number of lines to read"),
});

type ReadInput = z.infer<typeof readInputSchema>;

const READ_DESCRIPTION = `Reads a file from the sandbox filesystem and returns its contents with line numbers.

Usage:
- The file_path must be an absolute path
- By default, reads up to 500 lines from the start
- Use offset and limit to paginate large files
- Results include line numbers starting at 1
- Cannot read binary files`;

const BINARY_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "zip", "tar", "gz", "exe", "bin", "so", "dylib"];

export function createReadTool(sandbox: Sandbox, config?: ToolConfig) {
  const maxLines = config?.maxFileSize ?? 500;

  return tool({
    description: READ_DESCRIPTION,
    inputSchema: zodSchema(readInputSchema),
    strict: config?.strict,
    needsApproval: config?.needsApproval,
    providerOptions: config?.providerOptions,
    execute: async ({ file_path, offset, limit }: ReadInput): Promise<ReadOutput | ReadError> => {
      if (config?.allowedPaths) {
        const allowed = config.allowedPaths.some((p) => file_path.startsWith(p));
        if (!allowed) return { error: `Path not allowed: ${file_path}` };
      }

      try {
        const exists = await sandbox.fileExists(file_path);
        if (!exists) return { error: `Path not found: ${file_path}` };

        const isDir = await sandbox.isDirectory(file_path);
        if (isDir) {
          const entries = await sandbox.readDir(file_path);
          return { type: "directory", entries: entries.map((e) => e.name), count: entries.length };
        }

        const content = await sandbox.readFile(file_path);

        // Detect binary files early
        const nullIdx = content.indexOf("\0");
        if (nullIdx !== -1 && nullIdx < 1000) {
          const ext = file_path.split(".").pop()?.toLowerCase();
          if (BINARY_EXTENSIONS.includes(ext ?? "")) {
            return { error: `Cannot read binary file: ${file_path}` };
          }
        }

        const allLines = content.split("\n");
        const totalLines = allLines.length;

        if (!limit && totalLines > maxLines) {
          return {
            error: `File is large (${totalLines} lines). Use 'offset' and 'limit' to read in chunks. Example: offset=1, limit=100.`,
          };
        }

        const startLine = offset ? offset - 1 : 0;
        const endLine = limit ? startLine + limit : allLines.length;
        const selectedLines = allLines.slice(startLine, endLine);

        const lines = selectedLines.map((line, i) => ({
          line_number: startLine + i + 1,
          content: line,
        }));

        return {
          type: "text",
          content: selectedLines.join("\n"),
          lines,
          total_lines: totalLines,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
