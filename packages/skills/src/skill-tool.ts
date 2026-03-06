import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { SkillMetadata } from "./types.js";

export interface SkillOutput {
  skill: string;
  path: string;
  message: string;
}

export interface SkillError {
  error: string;
}

const skillInputSchema = z.object({
  skill_name: z.string().describe("Name of the skill to activate"),
});

type SkillInput = z.infer<typeof skillInputSchema>;

const SKILL_DESCRIPTION = `Activate a skill to get detailed instructions for a specialized task.

When you activate a skill, read the SKILL.md file at the provided location using the Read tool.
Skills provide step-by-step guidance for complex tasks.`;

/**
 * Creates the Skill tool for on-demand skill activation.
 * Skills use progressive disclosure — only metadata is injected into the system
 * prompt; the agent reads the full SKILL.md on demand via the Read tool.
 */
export function createSkillTool(
  skills: Record<string, SkillMetadata>,
  onActivate?: (skill: SkillMetadata) => void | Promise<void>,
) {
  return tool({
    description: SKILL_DESCRIPTION,
    inputSchema: zodSchema(skillInputSchema),
    execute: async ({ skill_name }: SkillInput): Promise<SkillOutput | SkillError> => {
      const skill = skills[skill_name];
      if (!skill) {
        const available = Object.keys(skills).join(", ");
        return { error: `Skill "${skill_name}" not found. Available: ${available || "none"}` };
      }

      await onActivate?.(skill);

      return {
        skill: skill.name,
        path: skill.path,
        message: `Skill "${skill.name}" activated. Read the full instructions at: ${skill.path}`,
      };
    },
  });
}
