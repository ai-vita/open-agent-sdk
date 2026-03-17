/**
 * Lightweight skill metadata (name, description, path only).
 * Loaded at discovery time for progressive disclosure.
 */
export interface SkillMetadata {
  /** Skill identifier: 1-64 chars, lowercase + hyphens, matches folder name */
  name: string;
  /** When to use this skill: 1-1024 chars */
  description: string;
  /** Absolute path to the SKILL.md file */
  path: string;
  /** Optional license name */
  license?: string;
  /** Environment requirements */
  compatibility?: string;
  /** Arbitrary key-value metadata */
  metadata?: Record<string, string>;
  /** Space-delimited list of pre-approved tools */
  allowedTools?: string[];
}

/**
 * A fetched skill bundle — name + all files as a map of relative path → content.
 */
export interface SkillBundle {
  name: string;
  files: Record<string, string>;
}

/**
 * Options for discoverSkills().
 */
export interface DiscoverSkillsOptions {
  /** Override default discovery paths. Default: [".skills", "~/.agents/skills"] */
  paths?: string[];
  /** Working directory for resolving relative paths. Default: process.cwd() */
  cwd?: string;
}
