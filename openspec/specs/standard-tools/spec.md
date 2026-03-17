# standard-tools Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Bash tool executes shell commands
The Bash tool SHALL execute a given command string in the sandbox's shell and return stdout, stderr, and exit code.

#### Scenario: Successful command
- **WHEN** the Bash tool is called with `{ command: "echo hello" }`
- **THEN** the result SHALL contain the command output

#### Scenario: Failed command
- **WHEN** the Bash tool is called with a command that exits with non-zero status
- **THEN** the result SHALL contain the error output and exit code without throwing

#### Scenario: Output truncation
- **WHEN** the command produces output exceeding the configured `maxOutputLength`
- **THEN** the output SHALL be truncated with a middle-truncation strategy preserving the beginning and end

### Requirement: Read tool reads file contents
The Read tool SHALL read a file from the sandbox and return its contents with line numbers.

#### Scenario: Read entire file
- **WHEN** the Read tool is called with `{ file_path: "/path/to/file.ts" }`
- **THEN** the result SHALL contain the file contents with line numbers

#### Scenario: Read with offset and limit
- **WHEN** the Read tool is called with `{ file_path: "/path/to/file.ts", offset: 10, limit: 20 }`
- **THEN** the result SHALL contain only lines 10-29 of the file

#### Scenario: Read non-existent file
- **WHEN** the Read tool is called with a path that does not exist
- **THEN** the result SHALL be an error indicating the file was not found

### Requirement: Write tool creates or overwrites files
The Write tool SHALL write content to a file path in the sandbox, creating parent directories as needed.

#### Scenario: Create a new file
- **WHEN** the Write tool is called with `{ file_path: "/new/file.ts", content: "..." }`
- **THEN** the file SHALL be created with the given content, including any necessary parent directories

#### Scenario: Overwrite an existing file
- **WHEN** the Write tool is called with a path to an existing file
- **THEN** the file contents SHALL be completely replaced

### Requirement: Edit tool performs targeted string replacements
The Edit tool SHALL replace a specified old string with a new string in a file, supporting precise code modifications.

#### Scenario: Replace a string in a file
- **WHEN** the Edit tool is called with `{ file_path, old_string, new_string }`
- **THEN** the first occurrence of `old_string` SHALL be replaced with `new_string`

#### Scenario: Old string not found
- **WHEN** the Edit tool is called with an `old_string` that does not exist in the file
- **THEN** the result SHALL be an error indicating the string was not found

### Requirement: Glob tool finds files by pattern
The Glob tool SHALL search for files matching a glob pattern within the sandbox filesystem.

#### Scenario: Find TypeScript files
- **WHEN** the Glob tool is called with `{ pattern: "**/*.ts" }`
- **THEN** the result SHALL contain all matching file paths

#### Scenario: No matches
- **WHEN** the Glob tool is called with a pattern that matches no files
- **THEN** the result SHALL be an empty list

### Requirement: Grep tool searches file contents
The Grep tool SHALL search for a regex pattern across files in the sandbox, returning matching lines with context.

#### Scenario: Search for a pattern
- **WHEN** the Grep tool is called with `{ pattern: "function.*export", path: "./src" }`
- **THEN** the result SHALL contain matching lines with file paths and line numbers

#### Scenario: Use ripgrep when available
- **WHEN** ripgrep (`rg`) is available in the sandbox
- **THEN** the Grep tool SHALL use ripgrep for faster search performance

### Requirement: AskUser tool solicits user input
The AskUser tool SHALL present a question with optional preset options to the user and return their answer.

#### Scenario: Ask a question with options
- **WHEN** the AskUser tool is called with `{ question: "Which framework?", options: [...] }`
- **THEN** the configured `onQuestion` callback SHALL be invoked and its return value used as the answer

#### Scenario: Open-ended question
- **WHEN** the AskUser tool is called with a question and no options
- **THEN** the user SHALL be able to provide a free-text response

### Requirement: PlanMode tools enable planning workflow
The EnterPlanMode and ExitPlanMode tools SHALL allow agents to switch between planning and execution modes, controlled by shared state.

#### Scenario: Enter plan mode
- **WHEN** the EnterPlanMode tool is called
- **THEN** the agent's plan mode state SHALL be set to active

#### Scenario: Exit plan mode with a plan
- **WHEN** the ExitPlanMode tool is called with a plan
- **THEN** the plan mode state SHALL be deactivated and the plan returned

### Requirement: TodoWrite tool tracks task progress
The TodoWrite tool SHALL manage a list of tasks with status tracking (pending, in_progress, completed).

#### Scenario: Update task list
- **WHEN** the TodoWrite tool is called with an array of tasks
- **THEN** the task list state SHALL be updated and the configured `onUpdate` callback invoked

### Requirement: WebSearch tool searches the web
The WebSearch tool SHALL perform web searches and return results. Requires the `parallel-web` peer dependency.

#### Scenario: Search for a query
- **WHEN** the WebSearch tool is called with `{ query: "TypeScript best practices" }`
- **THEN** the result SHALL contain search results with titles, URLs, and snippets

### Requirement: WebFetch tool fetches and processes URLs
The WebFetch tool SHALL fetch content from a URL, convert HTML to markdown, and optionally process it with an AI model. Requires the `parallel-web` peer dependency.

#### Scenario: Fetch and process a URL
- **WHEN** the WebFetch tool is called with `{ url: "https://example.com", prompt: "Summarize this page" }`
- **THEN** the result SHALL contain the AI-processed summary of the page content

