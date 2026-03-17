# compaction-improvements Specification

## Purpose

Improve conversation compaction with token-based split points, structured summarization prompts, file operations tracking, and split-turn awareness.

## Requirements
### Requirement: Token-based split point replaces message-count split
The `compactConversation` function SHALL use a `keepRecentTokens` option (default: 20000) that determines how many tokens of recent conversation to preserve. It SHALL walk backwards from the newest message, accumulating estimated tokens, and find a valid cut point at a user or assistant message boundary. The previous `protectRecentMessages` option SHALL be removed.

#### Scenario: Split at token budget boundary
- **WHEN** `keepRecentTokens` is 20000 and the last 8 messages total ~21000 tokens
- **THEN** the cut point SHALL be placed before those 8 messages, keeping them intact

#### Scenario: Cut point avoids mid-tool-result
- **WHEN** the token budget boundary falls on a tool-result message
- **THEN** the cut point SHALL be moved earlier to the preceding user or assistant message boundary

### Requirement: Reserve tokens for summary output
The `CompactConversationConfig` SHALL accept a `reserveTokens` option (default: 16384) that caps the summarizer model's output. The summarization call SHALL set `maxOutputTokens` to `Math.floor(0.8 * reserveTokens)`.

#### Scenario: Summary output capped
- **WHEN** compaction runs with `reserveTokens: 16384`
- **THEN** the summarizer model call SHALL use `maxOutputTokens: 13107`

#### Scenario: Threshold uses reserveTokens
- **WHEN** `contextNeedsCompaction` is called with `reserveTokens` set
- **THEN** compaction SHALL trigger when estimated tokens exceed `maxTokens - reserveTokens`

### Requirement: Structured summarization prompt
The compaction summarizer SHALL use a structured prompt requesting specific sections: Goal, Constraints & Preferences, Progress (Done/In Progress/Blocked), Key Decisions, Next Steps, and Critical Context. File paths, function names, and error messages SHALL be preserved verbatim.

#### Scenario: Initial summarization
- **WHEN** compaction runs with no prior summary
- **THEN** the summarizer SHALL receive a system prompt identifying it as a "context summarization assistant" and a user prompt with the structured template

#### Scenario: Update summarization with prior summary
- **WHEN** compaction runs and `state.conversationSummary` is non-empty
- **THEN** the summarizer SHALL receive an update prompt that includes the previous summary in a `<previous-summary>` block, with instructions to preserve existing information and add new progress

### Requirement: File operations tracking
The compaction process SHALL extract file paths from `read`, `write`, and `edit` tool calls in messages being summarized, and append them as XML blocks to the summary output.

#### Scenario: Files extracted from tool calls
- **WHEN** summarized messages contain tool calls for `Read({ file_path: "/src/a.ts" })` and `Edit({ file_path: "/src/b.ts" })`
- **THEN** the summary SHALL end with `<read-files>` containing `/src/a.ts` and `<modified-files>` containing `/src/b.ts`

#### Scenario: Read-only files excluded from modified
- **WHEN** a file appears in both `read` and `edit` tool calls
- **THEN** it SHALL appear only in `<modified-files>`, not in `<read-files>`

#### Scenario: No tool calls
- **WHEN** summarized messages contain no file-related tool calls
- **THEN** no `<read-files>` or `<modified-files>` blocks SHALL be appended

### Requirement: Split-turn awareness
When the cut point falls within a turn (between a user message and its subsequent assistant/tool messages), compaction SHALL generate two parallel summaries: one for history before the turn, one for the turn prefix. The results SHALL be combined with a separator.

#### Scenario: Cut splits a turn
- **WHEN** the token-based cut point lands on an assistant message that follows a user message
- **THEN** the system SHALL identify the turn start (user message), summarize history before the turn, summarize the turn prefix separately, and combine both summaries

#### Scenario: Clean cut at turn boundary
- **WHEN** the cut point lands on a user message
- **THEN** only a single summarization call SHALL be made (no split-turn handling)

### Requirement: Message serialization for summarization
Messages sent to the summarizer SHALL be serialized as human-readable text (not raw JSON), with role labels, reasoning content, tool call names with arguments, and tool result output.

#### Scenario: Tool call serialization
- **WHEN** an assistant message contains tool calls for `read(path="/x.ts")` and `write(path="/y.ts")`
- **THEN** the serialized text SHALL include `[Assistant tool calls]: read(path="/x.ts"); write(path="/y.ts", ...)`

#### Scenario: Reasoning content included
- **WHEN** an assistant message contains reasoning/thinking content
- **THEN** the serialized text SHALL include it under an `[Assistant thinking]:` label

