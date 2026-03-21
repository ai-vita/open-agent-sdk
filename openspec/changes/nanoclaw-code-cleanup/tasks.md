## 1. Channel interface cleanup

- [x] 1.1 Remove registry code from `channels/interface.ts` (Map, registerChannel, getChannelFactory, getRegisteredChannelNames, clearChannelRegistry) — keep only `Channel` and `ChannelFactory` type exports
- [x] 1.2 Delete `channels/interface.test.ts` (tests the removed registry)
- [x] 1.3 Change `ChannelFactory` return type from `Channel | null` to `Channel`
- [x] 1.4 Update `channels/telegram.ts` — remove internal null/token check, accept `token` as a parameter, always construct Bot
- [x] 1.5 Update `index.ts` — remove `registerChannel` calls, guard telegram creation with `if (config.telegramBotToken)`, pass token to factory, remove null checks on factory results

## 2. Config cleanup

- [x] 2.1 Keep `telegramBotToken` and `apiKey` in `NanoclawConfig` — no changes needed to types.ts or config.ts

## 3. Loop and DB cleanup

- [x] 3.1 Replace `Map<string, boolean>` with `Set<string>` in `loop.ts` poll grouping
- [x] 3.2 Remove duplicate `storeChatMetadata` call from `onMessage` callback in `index.ts` (keep the one in `loop.ts`)
- [x] 3.3 Simplify `getNewMessages` in `store/db.ts` — remove `chatIds` parameter and the filtering branch, always query all chats
- [x] 3.4 Update `loop.ts` call site to drop the empty `[]` argument to `getNewMessages`

## 4. Runner cleanup

- [x] 4.1 Remove empty-string spacer from system prompt array in `runner.ts`, use `\n` in adjacent string instead

## 5. Verify

- [x] 5.1 Run `pnpm typecheck` — ensure no type errors
- [x] 5.2 Run `pnpm test` — ensure all tests pass (remaining tests after registry test deletion)
