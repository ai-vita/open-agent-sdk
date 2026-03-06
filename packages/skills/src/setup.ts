import type { Sandbox } from "@open-agent-sdk/core";
import { parseSkillMetadata } from "./parser.js";
import type { SkillBundle, SkillMetadata } from "./types.js";

export interface AgentEnvironmentConfig {
  /** Named workspace directories to create in the sandbox */
  workspace?: Record<string, string>;
  /** Skills to seed: name → SkillBundle or raw SKILL.md content */
  skills?: Record<string, SkillBundle | string>;
}

export interface SetupResult {
  /** Parsed skill metadata for use with skillsToXml() */
  skills: SkillMetadata[];
}

/**
 * Sets up an agent environment in a sandbox.
 * Creates workspace directories and writes skill files.
 */
export async function setupAgentEnvironment(
  sandbox: Sandbox,
  config: AgentEnvironmentConfig,
): Promise<SetupResult> {
  const skills: SkillMetadata[] = [];

  // Create workspace directories
  if (config.workspace) {
    for (const path of Object.values(config.workspace)) {
      await sandbox.writeFile(`${path}/.keep`, "");
    }
  }

  if (config.skills) {
    for (const [name, content] of Object.entries(config.skills)) {
      const skillDir = `.skills/${name}`;

      if (typeof content === "object" && "files" in content) {
        // SkillBundle: write all files
        for (const [relativePath, fileContent] of Object.entries(content.files)) {
          await sandbox.writeFile(`${skillDir}/${relativePath}`, fileContent);
        }

        const skillMdContent = content.files["SKILL.md"];
        if (skillMdContent) {
          try {
            skills.push(parseSkillMetadata(skillMdContent, `${skillDir}/SKILL.md`));
          } catch {
            skills.push({ name, description: `Skill: ${name}`, path: `${skillDir}/SKILL.md` });
          }
        }
      } else {
        // Raw string SKILL.md content
        const skillPath = `${skillDir}/SKILL.md`;
        await sandbox.writeFile(skillPath, content);
        try {
          skills.push(parseSkillMetadata(content, skillPath));
        } catch {
          skills.push({ name, description: `Skill: ${name}`, path: skillPath });
        }
      }
    }
  }

  return { skills };
}
