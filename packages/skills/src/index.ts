// Types
export type { SkillMetadata, SkillBundle, DiscoverSkillsOptions } from "./types.js";

// Parser
export { parseSkillMetadata } from "./parser.js";

// Discovery
export { discoverSkills } from "./discovery.js";

// Remote fetch
export { fetchSkill, fetchSkills } from "./fetch.js";

// XML formatting for system prompts
export { skillsToXml } from "./xml.js";

// Agent environment setup
export { setupAgentEnvironment } from "./setup.js";
export type { AgentEnvironmentConfig, SetupResult } from "./setup.js";

// Skill tool
export { createSkillTool } from "./skill-tool.js";
export type { SkillOutput, SkillError } from "./skill-tool.js";
