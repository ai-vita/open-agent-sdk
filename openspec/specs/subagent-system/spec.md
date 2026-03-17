# subagent-system Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Sub-agents run with isolated context
The sub-agent system SHALL allow spawning a new agent loop with its own message history, isolated from the parent agent's conversation context.

#### Scenario: Sub-agent does not see parent messages
- **WHEN** a sub-agent is spawned via the Task tool
- **THEN** the sub-agent SHALL start with its own system prompt and messages, without access to the parent's conversation history

#### Scenario: Sub-agent results returned to parent
- **WHEN** a sub-agent completes its task
- **THEN** the final result SHALL be returned to the parent agent as the Task tool's output

### Requirement: Sub-agents support tool restriction
The Task tool SHALL accept a list of allowed tools for the sub-agent, restricting which tools it can use.

#### Scenario: Restrict sub-agent to read-only tools
- **WHEN** a sub-agent is spawned with `tools: ["Read", "Glob", "Grep"]`
- **THEN** the sub-agent SHALL only have access to those three tools and SHALL NOT be able to use Bash, Write, or Edit

### Requirement: Sub-agent types are configurable
The Task tool SHALL support predefined sub-agent types, each with a system prompt and tool restriction.

#### Scenario: Define a research sub-agent type
- **WHEN** the Task tool is configured with `subagentTypes: { research: { systemPrompt: "...", tools: ["Read", "Grep"] } }`
- **THEN** spawning a task with `type: "research"` SHALL use that system prompt and tool set

#### Scenario: Dynamic sub-agent creation
- **WHEN** a sub-agent type is not predefined
- **THEN** the Task tool SHALL allow creating a sub-agent with an inline system prompt and tool list

### Requirement: Task tool is a standard tool
The Task tool SHALL follow the same factory function pattern as other tools and SHALL be usable with the Vercel AI SDK.

#### Scenario: Create task tool
- **WHEN** `createTaskTool({ model, tools, subagentTypes })` is called
- **THEN** the returned tool SHALL be compatible with the Vercel AI SDK's tool system

