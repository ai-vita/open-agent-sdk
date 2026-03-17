# agent-loop Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Agent loop executes multi-step tool-calling conversations
The core package SHALL provide a `runAgent()` function that accepts an `AgentOptions` object (including model, tools, system prompt, and initial messages) and returns an `AsyncGenerator<AgentEvent>` that yields events as the agent reasons and acts.

#### Scenario: Simple single-tool interaction
- **WHEN** `runAgent()` is called with a prompt that requires one tool call
- **THEN** the generator SHALL yield events for: assistant message, tool call, tool result, and final assistant response

#### Scenario: Multi-step reasoning
- **WHEN** the agent needs to call multiple tools sequentially to answer a question
- **THEN** the generator SHALL yield events for each step in order, and the agent SHALL continue until it produces a final text response or hits a stop condition

### Requirement: Agent loop supports stop conditions
The `AgentOptions` SHALL accept a `stopWhen` function that evaluates after each step and can terminate the agent loop early.

#### Scenario: Stop after N steps
- **WHEN** `stopWhen` is configured to stop after 5 steps
- **THEN** the agent loop SHALL terminate after at most 5 steps, even if the agent has not produced a final response

#### Scenario: Stop on budget exceeded
- **WHEN** a budget tracker signals that the cost limit has been reached
- **THEN** the agent loop SHALL terminate and yield a final event indicating budget exhaustion

### Requirement: Agent loop supports streaming
The `runAgent()` function SHALL support both streaming (via `streamText`) and non-streaming (via `generateText`) modes, controlled by an option.

#### Scenario: Streaming mode yields partial text events
- **WHEN** `runAgent()` is called with `stream: true`
- **THEN** the generator SHALL yield incremental text delta events as the LLM produces tokens

#### Scenario: Non-streaming mode yields complete messages
- **WHEN** `runAgent()` is called with `stream: false` (default)
- **THEN** the generator SHALL yield complete assistant message events after each step

### Requirement: Agent loop supports context compaction
The agent loop SHALL monitor token usage and, when approaching the context limit, compact older messages into a summary to free up context space.

#### Scenario: Conversation exceeds token threshold
- **WHEN** the estimated token count exceeds 85% of the model's context window
- **THEN** the agent loop SHALL summarize older messages and replace them with a compact summary, preserving recent messages

### Requirement: Agent loop integrates with Vercel AI SDK
The agent loop SHALL use the Vercel AI SDK's `generateText` or `streamText` functions internally, accepting any `LanguageModel` compatible with the AI SDK.

#### Scenario: Use with Anthropic provider
- **WHEN** `runAgent()` is called with `model: anthropic("claude-sonnet-4-20250514")`
- **THEN** the agent loop SHALL function correctly using the Anthropic provider

#### Scenario: Use with OpenAI provider
- **WHEN** `runAgent()` is called with `model: openai("gpt-4o")`
- **THEN** the agent loop SHALL function correctly using the OpenAI provider

