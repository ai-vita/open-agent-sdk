## 1. Simplify WebFetchConfig and remove AI dependency

- [x] 1.1 Remove `model: LanguageModel` field from `WebFetchConfig` interface in `packages/tools-web/src/web-fetch.ts`
- [x] 1.2 Remove `generateText` and `LanguageModel` imports from `packages/tools-web/src/web-fetch.ts`
- [x] 1.3 Remove destructuring of `model` from `config` in `createWebFetchTool`

## 2. Pass prompt as objective to extract call

- [x] 2.1 Add `objective: prompt` to the `client.beta.extract()` call parameters
- [x] 2.2 Remove the `generateText` call and replace the return value with the extracted content directly (using `full_content` or joined `excerpts`)

## 3. Update exports and public API if needed

- [x] 3.1 Check `packages/tools-web/src/index.ts` (or barrel) to confirm `WebFetchConfig` is re-exported and no `LanguageModel` re-export was added
- [x] 3.2 Verify TypeScript compiles cleanly across the workspace (`pnpm tsc --noEmit` or equivalent)

## 4. Tests

- [x] 4.1 Update or create `packages/tools-web/src/web-fetch.test.ts` to verify `objective` is passed to the extract call
- [x] 4.2 Add test asserting no `generateText` call occurs
- [x] 4.3 Add test for the fallback path (excerpts used when `full_content` is absent)
- [x] 4.4 Run tests: `pnpm test --filter tools-web` (or equivalent) and confirm passing
