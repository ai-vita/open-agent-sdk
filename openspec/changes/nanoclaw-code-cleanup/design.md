## Context

The initial nanoclaw commit (`693e8bd`) introduced a working multi-channel AI assistant daemon. A line-by-line review surfaced dead code, type imprecision, and redundant logic that should be cleaned up before the codebase grows further.

All changes are in `packages/nanoclaw/src/`. No behavioral changes, no new dependencies.

## Goals / Non-Goals

**Goals:**
- Remove all dead code paths identified in review
- Tighten types where the current signatures are looser than reality
- Reduce surface area of the channel interface module

**Non-Goals:**
- Adding features or new functionality
- Refactoring architecture (channel system, loop, runner stay structurally the same)
- Changing the `gateway()` call or model configuration (separate concern)

## Decisions

### 1. Remove channel registry, keep types-only interface.ts

The registry (`Map`, `registerChannel`, `getChannelFactory`, etc.) is never queried in production — index.ts calls factory functions directly. Remove the registry and its test file. `interface.ts` becomes a pure types file exporting `Channel` and `ChannelFactory`.

### 2. ChannelFactory returns Channel (not Channel | null), receives config

Move the env-var guard to the call site in index.ts, and pass credentials via config instead of reading `process.env` inside factories:

```typescript
// Before (telegram.ts checks process.env internally, returns null)
const telegram = createTelegramChannel({ onMessage });
if (telegram) { ... }

// After (index.ts checks config, passes token to factory)
if (config.telegramBotToken) {
  const telegram = createTelegramChannel({ token: config.telegramBotToken, onMessage });
  await telegram.connect();
  activeChannels.push(telegram);
}
```

telegram.ts drops the null check and env read — it receives the token as a parameter and always constructs a Bot. This makes the type honest and config the single source of truth for credentials.

### 3. Keep config fields, wire them through

`telegramBotToken` and `apiKey` stay in `NanoclawConfig`. The fix is the opposite direction — make consumers read from config instead of `process.env` directly. `telegramBotToken` gets passed to the factory (see decision 2). `apiKey` stays for future use (e.g. non-Vercel providers).

### 4. Set instead of Map for chat grouping

`loop.ts` uses `Map<string, boolean>` as a set. Replace with `Set<string>` — clearer intent, same performance.

### 5. Single storeChatMetadata call site

Currently called in both the `onMessage` callback (index.ts) and the poll loop (loop.ts). The poll loop version is sufficient — it runs on the same messages. Remove the duplicate in `onMessage` to keep a single call site.

### 6. Simplify getNewMessages

The `chatIds` parameter branch (filtering by specific chat IDs) is dead — every call site passes `[]`. Simplify to always query all chats. Remove the `chatIds` parameter entirely.

### 7. Clean system prompt construction

Replace the empty-string-as-spacer pattern in `runner.ts` with explicit `\n` in the preceding string. Fewer array elements, same output.

## Risks / Trade-offs

- **Removing chatIds from getNewMessages narrows the API** → Acceptable since nanoclaw has no consumers beyond its own loop.ts. If per-chat filtering is needed later, it can be re-added with a clearer API.
- **ChannelFactory type change is breaking for any external channel implementations** → No external consumers exist yet. The type is internal to the package.
