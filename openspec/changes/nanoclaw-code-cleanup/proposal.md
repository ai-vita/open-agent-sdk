## Why

The initial nanoclaw commit introduced dead code, type imprecision, and config bypasses that will compound as the package grows. Cleaning these up now — before any downstream code depends on them — is the cheapest time to do it.

## What Changes

- Remove the channel registry (`registerChannel`, `getChannelFactory`, `getRegisteredChannelNames`, `clearChannelRegistry`) and its tests — unused in production code
- Make `ChannelFactory` always return `Channel` (remove `| null`); move env-var gating to the call site in index.ts, pass credentials via config instead of reading `process.env` inside factories
- Wire `telegramBotToken` through config to the factory (keep config as single source of truth for credentials)
- Replace `Map<string, boolean>` with `Set<string>` in loop.ts poll grouping
- Remove duplicate `storeChatMetadata` call (called in both onMessage callback and poll loop)
- Simplify `getNewMessages` — remove dead `chatIds` filtering branch (always called with `[]`)
- Clean up empty-string spacer in runner.ts system prompt array

## Capabilities

### New Capabilities

None — this is a pure cleanup.

### Modified Capabilities

None — no spec-level behavior changes.

## Impact

- **packages/nanoclaw/src/** — all changes scoped here
- No API surface changes (nanoclaw has no published API yet)
- No dependency changes
- No behavior changes — all modifications remove dead/redundant code or tighten types
