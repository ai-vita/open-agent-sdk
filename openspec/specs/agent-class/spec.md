# agent-class Specification

## Purpose
TBD - created by archiving change adopt-edge-pi-patterns. Update Purpose after archive.
## Requirements
### Requirement: Agent class wraps runAgent with stateful orchestration
The `Agent` class SHALL accept the same options as `runAgent()` plus optional `sessionManager` and `compaction` configuration. It SHALL provide `generate()` and `stream()` methods that delegate to `runAgent()`.

#### Scenario: Basic generate without optional features
- **WHEN** an `Agent` is created with `{ model, tools, system }` and `generate("hello")` is called
- **THEN** it SHALL yield the same events as `runAgent({ model, tools, system, messages: "hello" })`

#### Scenario: Basic stream
- **WHEN** an `Agent` is created with `{ model, tools, system, stream: true }` and `stream("hello")` is called
- **THEN** it SHALL yield events including `text-delta` events

### Requirement: Agent manages conversation state
The `Agent` SHALL accumulate messages across multiple `generate()` or `stream()` calls, maintaining conversation continuity.

#### Scenario: Multi-turn conversation
- **WHEN** `generate("What is 2+2?")` is called, then `generate("And 3+3?")` is called
- **THEN** the second call SHALL include all messages from the first call's response in its input

### Requirement: Agent auto-persists to session
When a `sessionManager` is provided, the `Agent` SHALL automatically append input and response messages to the session after each `generate()` or `stream()` call.

#### Scenario: Messages persisted after generate
- **WHEN** an `Agent` with a `sessionManager` calls `generate("hello")`
- **THEN** the user message and all assistant response messages SHALL be appended to the session

#### Scenario: Session resumption
- **WHEN** an `Agent` is created with a `sessionManager` containing prior messages
- **THEN** `getMessages()` on the session SHALL return those prior messages
- **AND** the next `generate()` call SHALL include them as context

### Requirement: Agent auto-compacts conversation
When `compaction` config is provided, the `Agent` SHALL check for compaction need after each `generate()` or `stream()` call and compact if the threshold is exceeded.

#### Scenario: Compaction triggered
- **WHEN** the conversation exceeds the compaction threshold after a `generate()` call
- **THEN** the `Agent` SHALL invoke `compactConversation()` and update its internal message state with the compacted result

#### Scenario: Compaction not needed
- **WHEN** the conversation is below the compaction threshold
- **THEN** no compaction SHALL occur and messages SHALL remain unchanged

### Requirement: Agent supports message steering
The `Agent` SHALL provide a `steer(message)` method that queues a message to be injected before the next model step.

#### Scenario: Steer injects message
- **WHEN** `agent.steer({ role: "user", content: "Focus on error handling" })` is called before `generate("Write a function")`
- **THEN** the steered message SHALL be included in the messages sent to the model, before the new user prompt

#### Scenario: Steer clears after use
- **WHEN** a steered message is consumed by a `generate()` call
- **THEN** subsequent `generate()` calls SHALL NOT include the steered message again

### Requirement: Agent class exported from core
The `Agent` class SHALL be exported from `@open-agent-sdk/core`.

#### Scenario: Import path
- **WHEN** a consumer imports `{ Agent } from "@open-agent-sdk/core"`
- **THEN** the import SHALL resolve to the `Agent` class

