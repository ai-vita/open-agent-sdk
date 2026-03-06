import type { SkillMetadata } from "./types.js";

/**
 * Parses YAML frontmatter from a SKILL.md file.
 * Validates required fields and name format per the Agent Skills spec.
 */
export function parseSkillMetadata(content: string, skillPath: string): SkillMetadata {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    throw new Error(`No YAML frontmatter found in ${skillPath}`);
  }

  const parsed = parseYaml(frontmatter);

  if (!parsed.name || typeof parsed.name !== "string") {
    throw new Error(`Missing or invalid 'name' field in ${skillPath}`);
  }
  if (!parsed.description || typeof parsed.description !== "string") {
    throw new Error(`Missing or invalid 'description' field in ${skillPath}`);
  }

  const nameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (
    parsed.name.length > 64 ||
    (parsed.name.length > 1 && !nameRegex.test(parsed.name)) ||
    parsed.name.includes("--")
  ) {
    throw new Error(
      `Invalid 'name' format in ${skillPath}: must be 1-64 lowercase chars/hyphens`,
    );
  }

  let allowedTools: string[] | undefined;
  if (parsed["allowed-tools"]) {
    allowedTools = String(parsed["allowed-tools"]).split(/\s+/).filter(Boolean);
  }

  let metadata: Record<string, string> | undefined;
  if (parsed.metadata && typeof parsed.metadata === "object") {
    metadata = {};
    for (const [key, value] of Object.entries(parsed.metadata as Record<string, unknown>)) {
      metadata[key] = String(value);
    }
  }

  return {
    name: parsed.name,
    description: parsed.description,
    path: skillPath,
    license: parsed.license ? String(parsed.license) : undefined,
    compatibility: parsed.compatibility ? String(parsed.compatibility) : undefined,
    metadata,
    allowedTools,
  };
}

function extractFrontmatter(content: string): string | null {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return null;
  const endIndex = trimmed.indexOf("\n---", 3);
  if (endIndex === -1) return null;
  return trimmed.slice(3, endIndex).trim();
}

function parseYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let currentKey: string | null = null;
  let currentObject: Record<string, string> | null = null;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const nestedMatch = line.match(/^(\s{2,})(\w+):\s*(.*)$/);
    if (nestedMatch && currentKey && currentObject) {
      const [, , key, value] = nestedMatch;
      currentObject[key] = value.trim().replace(/^["']|["']$/g, "");
      continue;
    }

    const topMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (topMatch) {
      if (currentKey && currentObject) {
        result[currentKey] = currentObject;
        currentObject = null;
      }

      const [, key, value] = topMatch;
      const trimmedValue = value.trim();

      if (trimmedValue === "" || trimmedValue === "|" || trimmedValue === ">") {
        currentKey = key;
        currentObject = {};
      } else {
        result[key] = trimmedValue.replace(/^["']|["']$/g, "");
        currentKey = null;
      }
    }
  }

  if (currentKey && currentObject && Object.keys(currentObject).length > 0) {
    result[currentKey] = currentObject;
  }

  return result;
}
