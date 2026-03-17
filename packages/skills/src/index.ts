// Types

// Discovery
export { discoverSkills } from "./discovery.js";
// Remote fetch
export { fetchSkill, fetchSkills } from "./fetch.js";
// Parser
export { parseSkillMetadata } from "./parser.js";
export type { AgentEnvironmentConfig, SetupResult } from "./setup.js";
// Agent environment setup
export { setupAgentEnvironment } from "./setup.js";
export type { SkillError, SkillOutput } from "./skill-tool.js";
// Skill tool
export { createSkillTool } from "./skill-tool.js";
export type { DiscoverSkillsOptions, SkillBundle, SkillMetadata } from "./types.js";
// XML formatting for system prompts
export { skillsToXml } from "./xml.js";
