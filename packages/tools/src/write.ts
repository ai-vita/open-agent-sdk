import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";
import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface WriteOutput {
  message: string;
  bytes_written: number;
  file_path: string;
}

export interface WriteError {
  error: string;
}

const writeInputSchema = z.object({
  file_path: z.string().describe("Absolute path to the file to write"),
  content: z.string().describe("Content to write to the file"),
});

type WriteInput = z.infer<typeof writeInputSchema>;

const WRITE_DESCRIPTION = `Writes content to a file, creating parent directories as needed.

Guidelines:
- Overwrites existing files completely
- If modifying an existing file, use Read first then Edit instead
- Use Write for new files or full rewrites
- The file_path must be an absolute path`;

export function createWriteTool(sandbox: Sandbox, config?: ToolConfig) {
  return tool({
    description: WRITE_DESCRIPTION,
    inputSchema: zodSchema(writeInputSchema),
    strict: config?.strict,
    needsApproval: config?.needsApproval,
    providerOptions: config?.providerOptions,
    execute: async ({ file_path, content }: WriteInput): Promise<WriteOutput | WriteError> => {
      if (config?.allowedPaths) {
        const allowed = config.allowedPaths.some((p) => file_path.startsWith(p));
        if (!allowed) return { error: `Path not allowed: ${file_path}` };
      }

      const byteLength = Buffer.byteLength(content, "utf-8");

      if (config?.maxFileSize && byteLength > config.maxFileSize) {
        return {
          error: `Content exceeds maximum size of ${config.maxFileSize} bytes (got ${byteLength})`,
        };
      }

      try {
        await sandbox.writeFile(file_path, content);
        return {
          message: `Successfully wrote to ${file_path}`,
          bytes_written: byteLength,
          file_path,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
