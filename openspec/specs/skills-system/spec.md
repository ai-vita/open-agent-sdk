# skills-system Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Discover skills from filesystem
The skills package SHALL export a `discoverSkills(options?)` function that scans directories for `SKILL.md` files and returns an array of `SkillMetadata` objects (name, description, path).

#### Scenario: Discover project skills
- **WHEN** `discoverSkills({ cwd: "/my/project" })` is called and `.skills/pdf-processing/SKILL.md` exists
- **THEN** the result SHALL include a metadata entry for `pdf-processing` with its description and path

#### Scenario: Discover from multiple directories
- **WHEN** `discoverSkills({ paths: [".skills", "~/.agent/skills"] })` is called
- **THEN** skills from both directories SHALL be discovered, with project-level skills taking priority

#### Scenario: No skills found
- **WHEN** no `.skills/` directory exists
- **THEN** the result SHALL be an empty array

### Requirement: Parse SKILL.md files
The skills package SHALL export a `parseSkillMetadata(content, path)` function that extracts YAML frontmatter metadata from a SKILL.md file.

#### Scenario: Parse valid SKILL.md
- **WHEN** `parseSkillMetadata(content, "/path/to/SKILL.md")` is called with valid YAML frontmatter
- **THEN** the result SHALL contain `name`, `description`, `path`, and any optional fields (`license`, `compatibility`, `metadata`)

#### Scenario: Invalid frontmatter
- **WHEN** the SKILL.md has missing required fields (name or description)
- **THEN** the function SHALL throw an error indicating the missing fields

### Requirement: Fetch skills from GitHub
The skills package SHALL export `fetchSkill(ref)` and `fetchSkills(refs)` functions that download complete skill folders from GitHub repositories.

#### Scenario: Fetch a single skill
- **WHEN** `fetchSkill("anthropics/skills/pdf")` is called
- **THEN** the result SHALL be a `SkillBundle` with `name` and a `files` record mapping relative paths to their content

#### Scenario: Batch fetch multiple skills
- **WHEN** `fetchSkills(["anthropics/skills/pdf", "anthropics/skills/web-research"])` is called
- **THEN** the result SHALL be a record mapping skill names to their `SkillBundle` objects

### Requirement: Format skills as XML for system prompts
The skills package SHALL export a `skillsToXml(skills)` function that generates XML markup suitable for injection into LLM system prompts.

#### Scenario: Generate XML from skill metadata
- **WHEN** `skillsToXml(skills)` is called with an array of `SkillMetadata`
- **THEN** the result SHALL be an XML string listing each skill with its name, description, and path for on-demand loading

### Requirement: Set up agent environment with skills
The skills package SHALL export a `setupAgentEnvironment(sandbox, config)` function that creates workspace directories and writes skill files to the sandbox filesystem.

#### Scenario: Set up environment with remote skills
- **WHEN** `setupAgentEnvironment(sandbox, { skills: { pdf: skillBundle }, workspace: { notes: "files/notes/" } })` is called
- **THEN** the skill files SHALL be written to `.skills/pdf/` in the sandbox, workspace directories SHALL be created, and the returned metadata SHALL be usable with `skillsToXml()`

### Requirement: Progressive disclosure for skills
Skills SHALL use progressive disclosure — only metadata (name, description, path) is loaded at discovery time. Full SKILL.md content is loaded on-demand via the Read tool when the agent activates a skill.

#### Scenario: Discovery loads only metadata
- **WHEN** `discoverSkills()` scans 20 skill directories
- **THEN** only frontmatter SHALL be parsed (not full SKILL.md content), keeping token usage minimal (~50-100 tokens per skill)

