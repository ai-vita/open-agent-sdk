## Why

When a session is resumed via `oa -c` or `oa -r`, the full conversation history is restored into the LLM's context — but the user sees only "Resumed session ... (N messages)." They have no idea what the previous conversation was about, making session resumption disorienting. Claude Code solves this by visually replaying the conversation history; `oa` should do the same.

## What Changes

- On session resume, render previous conversation messages to the terminal before entering the interactive prompt
- Display user messages, assistant text, and tool call summaries using the same formatting as live output
- Cap displayed history to avoid flooding the terminal on long sessions (show last N exchanges, with a count of earlier messages)
- Use compaction summaries when available to represent the early portion of long sessions

## Capabilities

### New Capabilities
- `session-resume-display`: Visual replay of conversation history when resuming a session, including message rendering, truncation for long sessions, and compaction summary display

### Modified Capabilities

## Impact

- `packages/cli/src/cli.ts` — add history rendering logic after session resume detection
- `packages/core/src/session/session-manager.ts` — may need a method to retrieve raw session entries (not just ModelMessages) for richer display (e.g., distinguishing compaction summaries)
- No API or dependency changes
