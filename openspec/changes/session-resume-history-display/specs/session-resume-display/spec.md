## ADDED Requirements

### Requirement: Display conversation history on session resume
When a session is resumed via `--continue` or `--resume`, the CLI SHALL render previous conversation messages to the terminal before entering the interactive prompt.

#### Scenario: Resume session with conversation history
- **WHEN** user resumes a session containing previous messages
- **THEN** the CLI displays the previous conversation messages formatted with user prompts prefixed by `>`, assistant text rendered inline, and tool calls shown as one-liner summaries

#### Scenario: Resume empty or new session
- **WHEN** user resumes a session with no previous messages (e.g., session file exists but is empty)
- **THEN** no history is displayed, and the CLI proceeds directly to the interactive prompt

### Requirement: Truncate history for long sessions
The CLI SHALL limit the displayed history to the last 5 user turns. If earlier messages exist, a count indicator SHALL be shown.

#### Scenario: Session with more than 5 user turns
- **WHEN** user resumes a session with 12 user turns and no compaction
- **THEN** the CLI displays `... (7 earlier messages)` followed by the last 5 user turns with their assistant responses

#### Scenario: Session with 5 or fewer user turns
- **WHEN** user resumes a session with 3 user turns
- **THEN** all 3 turns are displayed in full, with no truncation indicator

### Requirement: Render compaction summaries
When the conversation path includes a compaction entry, the CLI SHALL render the compaction summary as a visually distinct block in place of the compacted messages.

#### Scenario: Session with compaction followed by recent messages
- **WHEN** user resumes a session that contains a compaction entry covering the first 20 messages, followed by 4 recent turns
- **THEN** the CLI displays the compaction summary as an indented block, followed by the 4 recent turns rendered normally

### Requirement: Tool calls displayed as one-liners
Tool call messages SHALL be rendered as a single line showing the tool name and truncated arguments. Tool results SHALL NOT be displayed.

#### Scenario: Assistant response with tool calls
- **WHEN** a previous assistant turn includes tool calls to `ReadFile` and `WriteFile`
- **THEN** each tool call is displayed as `[tool] ReadFile({"path":"src/foo.ts"...})` on its own line, and tool result content is omitted

### Requirement: Truncate long assistant text
Assistant text responses longer than 500 characters SHALL be truncated with an ellipsis.

#### Scenario: Long assistant response
- **WHEN** a previous assistant response contains 1200 characters of text
- **THEN** the displayed text is truncated to approximately 500 characters followed by `...`
