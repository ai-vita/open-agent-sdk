import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";
import { middleTruncate } from "@open-agent-sdk/core";
import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface BashOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
  interrupted: boolean;
  duration_ms: number;
}

export interface BashError {
  error: string;
}

const bashInputSchema = z.object({
  command: z.string().describe("The command to execute"),
  timeout: z
    .number()
    .nullable()
    .default(null)
    .describe("Optional timeout in milliseconds (max 600000)"),
  description: z
    .string()
    .nullable()
    .default(null)
    .describe("Clear, concise description of what this command does in 5-10 words"),
  run_in_background: z
    .boolean()
    .nullable()
    .default(null)
    .describe("Set to true to run this command in the background"),
});

type BashInput = z.infer<typeof bashInputSchema>;

const BASH_DESCRIPTION = `Executes a bash command in the sandbox shell with optional timeout.

IMPORTANT: For file operations (reading, writing, editing, searching, finding files) — use the specialized tools instead.

Usage notes:
  - The command argument is required
  - You can specify an optional timeout in milliseconds (max 600000ms / 10 minutes). Default is 120000ms.
  - Write a clear, concise description of what the command does in 5-10 words
  - If output exceeds the configured limit, it will be middle-truncated
  - Avoid \`find\`, \`grep\`, \`cat\`, \`head\`, \`tail\`, \`sed\`, \`awk\`. Use Glob, Grep, Read, Write, Edit instead.
  - For independent commands, make multiple parallel Bash calls
  - For dependent commands, chain with \`&&\``;

export function createBashTool(sandbox: Sandbox, config?: ToolConfig) {
  const maxOutputLength = config?.maxOutputLength ?? 30000;
  const defaultTimeout = config?.timeout ?? 120000;

  return tool({
    description: BASH_DESCRIPTION,
    inputSchema: zodSchema(bashInputSchema),
    strict: config?.strict,
    needsApproval: config?.needsApproval,
    providerOptions: config?.providerOptions,
    execute: async ({ command, timeout }: BashInput): Promise<BashOutput | BashError> => {
      if (config?.blockedCommands) {
        for (const blocked of config.blockedCommands) {
          if (command.includes(blocked)) {
            return { error: `Command blocked: contains '${blocked}'` };
          }
        }
      }

      try {
        const effectiveTimeout = Math.min(timeout ?? defaultTimeout, 600000);
        const result = await sandbox.exec(command, { timeout: effectiveTimeout });

        return {
          stdout: middleTruncate(result.stdout, maxOutputLength),
          stderr: middleTruncate(result.stderr, maxOutputLength),
          exit_code: result.exitCode,
          interrupted: result.interrupted,
          duration_ms: result.durationMs,
        };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
