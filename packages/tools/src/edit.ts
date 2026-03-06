import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";

export interface EditOutput {
  message: string;
  file_path: string;
  replacements: number;
}

export interface EditError {
  error: string;
}

const editInputSchema = z.object({
  file_path: z.string().describe("Absolute path to the file to modify"),
  old_string: z.string().describe("The exact text to find and replace"),
  new_string: z.string().describe("The replacement text"),
  replace_all: z
    .boolean()
    .nullable()
    .default(null)
    .describe("Replace all occurrences (default: false)"),
});

type EditInput = z.infer<typeof editInputSchema>;

const EDIT_DESCRIPTION = `Performs exact string replacements in files.

Guidelines:
- Read the file first with the Read tool before editing
- The old_string must match exactly, including whitespace
- If old_string appears multiple times, use replace_all=true or provide more context
- old_string and new_string must be different`;

export function createEditTool(sandbox: Sandbox, config?: ToolConfig) {
  return tool({
    description: EDIT_DESCRIPTION,
    inputSchema: zodSchema(editInputSchema),
    strict: config?.strict,
    needsApproval: config?.needsApproval,
    providerOptions: config?.providerOptions,
    execute: async ({
      file_path,
      old_string,
      new_string,
      replace_all: rawReplaceAll,
    }: EditInput): Promise<EditOutput | EditError> => {
      const replace_all = rawReplaceAll ?? false;

      if (old_string === new_string) {
        return { error: "old_string and new_string must be different" };
      }

      if (config?.allowedPaths) {
        const allowed = config.allowedPaths.some((p) => file_path.startsWith(p));
        if (!allowed) return { error: `Path not allowed: ${file_path}` };
      }

      try {
        const exists = await sandbox.fileExists(file_path);
        if (!exists) return { error: `File not found: ${file_path}` };

        const content = await sandbox.readFile(file_path);
        const occurrences = content.split(old_string).length - 1;

        if (occurrences === 0) {
          return { error: `String not found in file: "${old_string}"` };
        }

        if (!replace_all && occurrences > 1) {
          return {
            error: `String appears ${occurrences} times. Use replace_all=true or provide a more unique string.`,
          };
        }

        const newContent = replace_all
          ? content.split(old_string).join(new_string)
          : content.replace(old_string, new_string);
        const replacements = replace_all ? occurrences : 1;

        await sandbox.writeFile(file_path, newContent);

        return { message: `Successfully edited ${file_path}`, file_path, replacements };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}
