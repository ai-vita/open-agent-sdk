import type { SkillMetadata } from "./types.js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates XML markup listing available skills for injection into system prompts.
 * Agents can read the full SKILL.md via the Read tool using the path in <location>.
 *
 * @example
 * ```typescript
 * const xml = skillsToXml(skills);
 * // <available_skills>
 * //   <skill>
 * //     <name>pdf-processing</name>
 * //     <description>...</description>
 * //     <location>/path/to/SKILL.md</location>
 * //   </skill>
 * // </available_skills>
 * ```
 */
export function skillsToXml(skills: SkillMetadata[]): string {
  if (skills.length === 0) {
    return "<available_skills>\n</available_skills>";
  }

  const elements = skills
    .map(
      (skill) =>
        `  <skill>\n    <name>${escapeXml(skill.name)}</name>\n    <description>${escapeXml(skill.description)}</description>\n    <location>${escapeXml(skill.path)}</location>\n  </skill>`,
    )
    .join("\n");

  return `<available_skills>\n${elements}\n</available_skills>`;
}
