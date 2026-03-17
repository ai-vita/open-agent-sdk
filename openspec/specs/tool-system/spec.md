# tool-system Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Tools are factory functions
Each tool SHALL be created via a factory function that accepts a `Sandbox` instance and an optional configuration object, and returns a Vercel AI SDK-compatible `Tool` object.

#### Scenario: Create a tool with default config
- **WHEN** `createBashTool(sandbox)` is called with no config
- **THEN** the returned tool SHALL be usable with the Vercel AI SDK's `generateText()` and `streamText()` functions

#### Scenario: Create a tool with custom config
- **WHEN** `createBashTool(sandbox, { timeout: 5000 })` is called
- **THEN** the returned tool SHALL respect the custom timeout configuration

### Requirement: Tool inputs are validated with Zod schemas
Each tool factory SHALL define its input schema using Zod, providing compile-time and runtime type safety.

#### Scenario: Valid input passes validation
- **WHEN** a tool is called with input matching its Zod schema
- **THEN** the tool SHALL execute normally

#### Scenario: Invalid input fails validation
- **WHEN** a tool is called with input not matching its Zod schema
- **THEN** the Vercel AI SDK's validation layer SHALL reject the input before execution

### Requirement: Tools return typed results
Each tool SHALL return a discriminated union of success and error types, enabling consumers to handle both cases explicitly.

#### Scenario: Tool succeeds
- **WHEN** a tool execution completes successfully
- **THEN** the result SHALL contain the tool's output data in a typed success object

#### Scenario: Tool fails
- **WHEN** a tool execution encounters an error
- **THEN** the result SHALL contain an error message in a typed error object, without throwing an exception

### Requirement: Convenience function to create all standard tools
The tools package SHALL export a `createAgentTools(sandbox, config?)` function that creates all standard tools at once and returns them as a `ToolSet`.

#### Scenario: Create all tools with defaults
- **WHEN** `createAgentTools(sandbox)` is called
- **THEN** it SHALL return a `ToolSet` containing the 6 core sandbox tools: Bash, Read, Write, Edit, Glob, and Grep

#### Scenario: Create tools with per-tool configuration
- **WHEN** `createAgentTools(sandbox, { tools: { Bash: { timeout: 5000 } } })` is called
- **THEN** the Bash tool SHALL use the custom timeout, while other tools use defaults

#### Scenario: Enable optional tools via config
- **WHEN** `createAgentTools(sandbox, { askUser: { onQuestion }, planMode: true, webSearch: { apiKey } })` is called
- **THEN** the returned `ToolSet` SHALL include core sandbox tools plus AskUser, EnterPlanMode, ExitPlanMode, and WebSearch tools

#### Scenario: Optional tools are excluded by default
- **WHEN** `createAgentTools(sandbox)` is called without optional tool config
- **THEN** the returned `ToolSet` SHALL NOT include AskUser, PlanMode, Skill, WebSearch, WebFetch, or TodoWrite tools

### Requirement: Tools are composable
Tools SHALL support wrapping patterns (e.g., adding caching, logging, or permission checks around any tool) without modifying the tool's internal logic.

#### Scenario: Wrap a tool with caching
- **WHEN** a Read tool is wrapped with a caching decorator
- **THEN** subsequent calls with the same input SHALL return cached results without re-executing

