## Context

When `oa -c` or `oa -r` resumes a session, `SessionManager.getMessages()` restores the full message array into the agent's context. However, the CLI only prints `Resumed session <ts> (N messages).` — the user has no visibility into what the previous conversation covered.

Claude Code addresses this by visually replaying the full conversation on resume. We borrow this pattern, adapted for `oa`'s simpler terminal output.

## Goals / Non-Goals

**Goals:**
- Orient the user on resume by displaying previous conversation messages
- Keep output readable — cap history length and reduce tool-call noise
- Leverage existing compaction summaries for long sessions
- Zero additional API calls — purely local rendering from session data

**Non-Goals:**
- LLM-generated summaries on resume (too slow, costs tokens)
- Rich TUI / scrollable history viewer
- Changing the session file format

## Decisions

### 1. Render from SessionManager entries, not raw JSONL

**Choice:** Add a `getPathEntries()` method (or use existing `getEntries()` filtered to the leaf path) to walk the tree from leaf to root, then render each entry by type.

**Why:** `getMessages()` returns `ModelMessage[]` which loses entry type info (compaction vs message vs branch). We need entry types to render compaction summaries differently from regular messages.

**Alternative:** Parse the JSONL directly in the CLI. Rejected — duplicates tree-walking logic.

### 2. Truncate to last N user turns, not last N messages

**Choice:** Show the last 5 user turns (a "turn" = one user message + the assistant response that follows). If earlier messages exist, show `... (N earlier messages)` or the compaction summary if available.

**Why:** A fixed message count is unpredictable — one assistant turn with 10 tool calls would consume the budget. Turn-based truncation is more intuitive.

### 3. Render tool calls as one-liners, skip tool results

**Choice:** Tool calls display as `[tool] ToolName(truncated-args...)`. Tool results are not shown.

**Why:** Tool results (file contents, command output) are often huge and not useful for orientation. The tool call name + args gives enough context.

### 4. Compaction summaries render as a block quote

**Choice:** When a compaction entry is in the path, render it as:

```
│ Summary: <compaction summary text, truncated to ~3 lines>
```

**Why:** Visually distinct from regular messages, signals this is a condensed representation.

### 5. Rendering lives in cli.ts, not in core

**Choice:** The history display logic is a CLI concern — a `renderSessionHistory()` function in the CLI package.

**Why:** Core's `SessionManager` is environment-agnostic. Rendering to stdout is CLI-specific. Other consumers (web UI, API) would render differently.

### 6. CLI header appears before history, separated by visual dividers

**Choice:** The CLI header block (session name, skills list, "Type your message" instructions) is printed first, then the conversation history is rendered between `─` separator lines.

```
Resumed session 2026-03-18T09-55-25
Skills: commit, find-skills, fix
Type your message, or "/exit" to quit.

────────────────────────────────────────────────────────────
> previous user message

assistant response...
────────────────────────────────────────────────────────────

>
```

**Why:** Mixing header instructions with replayed history is confusing — the user can't tell what's "now" vs "before". Placing the header first gives immediate orientation (session identity, available skills), then the history replay is clearly delineated as past conversation. The `─` separators match the same visual language used during live conversation turns.

## Risks / Trade-offs

- **[Large assistant messages]** → Truncate assistant text to first ~500 chars with `...` if longer. Enough for orientation.
- **[Sessions with only tool calls, no text]** → Rare but possible. The tool-call one-liners still provide orientation.
- **[Compaction summary quality]** → Depends on the LLM that generated it. Out of scope to improve here.
