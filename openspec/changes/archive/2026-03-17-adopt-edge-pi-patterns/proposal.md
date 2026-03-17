## Why

[Edge-pi](https://github.com/marcusschiesser/edge-pi) (a comparable open-source coding agent SDK) has several architectural patterns that address gaps in our current SDK — particularly around testability, session persistence, path safety, agent ergonomics, and context compaction quality. Adopting the best of these patterns will make our SDK more robust, easier to test, and better suited for production use cases like long-running conversations.

## What Changes

- **In-memory sandbox for testing**: Add a `MemorySandbox` class that implements the `Sandbox` interface with an in-memory filesystem, enabling fast, deterministic tool tests without touching the real filesystem.
- **Session persistence layer**: Add a JSONL-based session manager that persists conversation messages, supports branching (rewind/fork), and integrates with compaction — enabling conversation continuity across restarts.
- **Workspace path safety**: Add a centralized path resolver that validates all tool file operations stay within the sandbox `cwd`, preventing path traversal attacks.
- **Agent class encapsulation**: Introduce an `Agent` class that wraps `runAgent()` with managed state — session persistence, auto-compaction, message steering — while keeping `runAgent()` as the low-level primitive.
- **Compaction improvements**: Upgrade `compactConversation` with token-based split points (instead of fixed message count), structured summarization prompts, file operations tracking, and split-turn awareness — all patterns proven in edge-pi's [compaction pipeline](https://github.com/marcusschiesser/edge-pi/tree/main/packages/edge-pi/src/compaction).

## Capabilities

### New Capabilities
- `memory-sandbox`: In-memory sandbox implementation for testing tools without filesystem side effects
- `session-persistence`: JSONL tree-based session manager for persisting and replaying conversation history with branching support
- `workspace-path-safety`: Centralized path resolver ensuring all file operations stay within the workspace root
- `agent-class`: Stateful `Agent` class wrapping `runAgent()` with session management, auto-compaction, and message steering
- `compaction-improvements`: Token-based split points, structured summarization prompts, file operations tracking, and split-turn handling for context compaction

### Modified Capabilities
<!-- No existing spec-level requirements are changing -->

## Impact

- **packages/core**: New `Agent` class, session manager, path resolver, upgraded compaction exports
- **packages/sandbox-local**: New `MemorySandbox` sibling package or in-package export
- **packages/tools**: Tools updated to use centralized path resolution instead of ad-hoc validation
- **API surface**: Additive — `runAgent()` stays unchanged; new `Agent` class is opt-in
- **Dependencies**: `proper-lockfile` (or equivalent) for session file locking; no other new external deps expected
- **Tests**: Existing tool tests can migrate to `MemorySandbox` for faster, more reliable runs
