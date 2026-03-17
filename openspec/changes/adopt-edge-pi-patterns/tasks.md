## 1. Workspace Path Safety

- [x] 1.1 Implement `resolveWorkspacePath(rootDir, requestedPath)` in `packages/core/src/workspace-path.ts` — normalize with `path.resolve`, validate the result starts with `rootDir`, throw on escape
- [x] 1.2 Export `resolveWorkspacePath` from `packages/core/src/index.ts`
- [x] 1.3 Write tests in `packages/core/src/workspace-path.test.ts` covering: absolute within root, relative resolution, dot-dot within root, dot-dot escaping root, empty path, trailing slashes, double slashes, single dot

## 2. Memory Sandbox

- [x] 2.1 Scaffold `packages/sandbox-memory` package with `package.json`, `tsconfig.json`, and `src/index.ts`
- [x] 2.2 Implement `MemorySandbox` class with in-memory `Map<string, string>` filesystem: `readFile`, `writeFile` (auto-create parents), `readDir`, `fileExists`, `isDirectory`, `destroy`
- [x] 2.3 Implement basic `exec()` with support for `echo` and stub responses for unsupported commands
- [x] 2.4 Accept `initialFiles: Record<string, string>` in constructor and optional `cwd`
- [x] 2.5 Write tests in `packages/sandbox-memory/src/index.test.ts` covering all spec scenarios: construct with/without initial files, write-then-read, parent directory creation, read non-existent throws, readDir, exec echo, unsupported command, destroy
- [x] 2.6 Add `sandbox-memory` to pnpm workspace and root tsconfig references

## 3. Session Persistence

- [x] 3.1 Define session entry types in `packages/core/src/session/types.ts`: `SessionEntry` union (`MessageEntry`, `CompactionEntry`, `BranchSummaryEntry`) with `id`, `parentId`, `type`, `timestamp` fields
- [x] 3.2 Implement `SessionManager` class in `packages/core/src/session/session-manager.ts`: constructor takes file path, creates file if missing, loads existing entries on init
- [x] 3.3 Implement `append(message: ModelMessage)` — write JSONL entry with unique id, set parentId to current leaf, update leaf pointer, use file locking
- [x] 3.4 Implement `getMessages()` — traverse parent pointers from leaf to root, return ordered `ModelMessage[]`, substitute compaction summaries for compacted messages
- [x] 3.5 Implement `branch(entryId, reason)` — move leaf to target entry, append `branch-summary` entry
- [x] 3.6 Implement `appendCompaction(summary, compactedEntryIds)` — append `compaction` entry, track which entries are replaced
- [x] 3.7 Add `proper-lockfile` as an optional peer dependency in `packages/core/package.json`
- [x] 3.8 Export `SessionManager` and session types from `packages/core/src/index.ts`
- [x] 3.9 Write tests in `packages/core/src/session/session-manager.test.ts` covering: new session creation, append single/multiple messages, getMessages ordering, branching, compaction entries, resume from existing file

## 4. Compaction Improvements

- [x] 4.1 Replace `protectRecentMessages` with `keepRecentTokens` (default 20000) and add `reserveTokens` (default 16384) to `CompactConversationConfig` in `packages/core/src/compaction.ts`
- [x] 4.2 Implement `findCutPoint(messages, keepRecentTokens)` — walk backwards accumulating tokens, find valid cut at user/assistant boundary (never mid-tool-result)
- [x] 4.3 Replace message-count split logic entirely with token-based split using `keepRecentTokens`
- [x] 4.4 Add `serializeMessages(messages)` utility — convert messages to human-readable text with role labels, `[Assistant thinking]:`, `[Assistant tool calls]:`, and `[Tool result]:` formatting
- [x] 4.5 Add structured summarization prompts: system prompt ("context summarization assistant"), initial template (Goal/Constraints/Progress/Decisions/Next Steps/Critical Context), and update template (preserve + extend previous summary)
- [x] 4.6 Implement `extractFileOperations(messages)` — scan tool calls for read/write/edit, return `{ readFiles: Set<string>, modifiedFiles: Set<string> }` with read-only exclusion
- [x] 4.7 Append `<read-files>` and `<modified-files>` XML blocks to compaction summary output
- [x] 4.8 Implement split-turn detection — when cut point is mid-turn, run two parallel summarizations (history + turn prefix) and combine with separator
- [x] 4.9 Set `maxOutputTokens: Math.floor(0.8 * reserveTokens)` on summarizer calls (0.5x for turn prefix)
- [x] 4.10 Update `contextNeedsCompaction` to support `reserveTokens`-based threshold (`tokens > maxTokens - reserveTokens`)
- [x] 4.11 Write tests in `packages/core/src/compaction.test.ts` covering: token-based split point, cut-point avoids tool-result, file ops extraction, split-turn detection, structured prompt assembly, reserveTokens threshold

## 5. Agent Class

- [x] 5.1 Implement `Agent` class in `packages/core/src/agent-class.ts`: constructor accepts `AgentOptions` plus optional `sessionManager` and `compaction` config
- [x] 5.2 Implement `generate(prompt)` — build messages from internal state + prompt, call `runAgent()`, collect events, update internal messages, return events
- [x] 5.3 Implement `stream(prompt)` — same as generate but with `stream: true`, return async generator of events
- [x] 5.4 Implement session auto-persistence — after generate/stream, append input and response messages to sessionManager if configured
- [x] 5.5 Implement auto-compaction — after generate/stream, check `contextNeedsCompaction()`, if true call `compactConversation()` and update internal state
- [x] 5.6 Implement `steer(message)` — queue message for injection before next generate/stream call, clear after use
- [x] 5.7 Implement session resumption — on construction with sessionManager, load existing messages via `getMessages()`
- [x] 5.8 Export `Agent` class from `packages/core/src/index.ts`
- [x] 5.9 Write tests in `packages/core/src/agent-class.test.ts` covering: basic generate, multi-turn state, steer injection and clearing, auto-compaction trigger

## 6. Integration and Documentation

- [x] 6.1 Update `examples/coding-agent/src/index.ts` to demonstrate `Agent` class usage as an alternative to `runAgent()`
- [x] 6.2 Run full test suite across all packages to verify no regressions
