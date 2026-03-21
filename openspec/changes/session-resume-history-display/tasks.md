## 1. Core: Expose path entries from SessionManager

- [x] 1.1 Add `getPathEntries()` method to `SessionManager` that returns entries along the leaf-to-root path (ordered root-first), preserving entry type info (message, compaction, branch_summary)
- [x] 1.2 Add tests for `getPathEntries()` in `session-manager.test.ts`

## 2. CLI: History rendering function

- [x] 2.1 Create `renderSessionHistory()` function in `packages/cli/src/history.ts` that takes path entries and renders them to stdout: user messages with `>` prefix, assistant text inline (truncated to 500 chars), tool calls as `[tool] Name(args...)` one-liners, compaction summaries as indented blocks
- [x] 2.2 Implement turn-based truncation: show last 5 user turns, display `... (N earlier messages)` for the rest, or show compaction summary if available
- [x] 2.3 Add tests for `renderSessionHistory()` in `packages/cli/src/history.test.ts`

## 3. CLI: Integrate into resume flow

- [x] 3.1 Call `renderSessionHistory()` in `cli.ts` after the `if (resumed)` block, replacing the current one-line message with the full history display
- [x] 3.2 Manual testing: verify `oa -c` and `oa -r` display history correctly for short sessions, long sessions, and compacted sessions
