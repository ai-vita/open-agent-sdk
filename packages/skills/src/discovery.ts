import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseSkillMetadata } from "./parser.js";
import type { DiscoverSkillsOptions, SkillMetadata } from "./types.js";

const DEFAULT_SKILL_PATHS = [".skills", "~/.agent/skills"];

/**
 * Discover skills from configured directories.
 * Only parses frontmatter for progressive disclosure (not full SKILL.md content).
 */
export async function discoverSkills(options?: DiscoverSkillsOptions): Promise<SkillMetadata[]> {
  const cwd = options?.cwd ?? process.cwd();
  const searchPaths = options?.paths ?? DEFAULT_SKILL_PATHS;

  const skills: SkillMetadata[] = [];
  const seenNames = new Set<string>();

  for (const searchPath of searchPaths) {
    const resolvedPath = resolvePath(searchPath, cwd);
    const foundSkills = await scanDirectory(resolvedPath);

    for (const skill of foundSkills) {
      // Deduplicate — first path wins (project > global)
      if (!seenNames.has(skill.name)) {
        seenNames.add(skill.name);
        skills.push(skill);
      }
    }
  }

  return skills;
}

function resolvePath(p: string, cwd: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p.startsWith("/")) return p;
  return resolve(cwd, p);
}

async function scanDirectory(dirPath: string): Promise<SkillMetadata[]> {
  const skills: SkillMetadata[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(dirPath, entry.name, "SKILL.md");
      try {
        const s = await stat(skillPath);
        if (!s.isFile()) continue;
        const content = await readFile(skillPath, "utf-8");
        const metadata = parseSkillMetadata(content, skillPath);
        if (metadata.name !== entry.name) {
          console.warn(
            `Skill name "${metadata.name}" does not match folder "${entry.name}" in ${skillPath}`,
          );
        }
        skills.push(metadata);
      } catch {
        // Skip skills with missing/unreadable SKILL.md
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable
  }
  return skills;
}
