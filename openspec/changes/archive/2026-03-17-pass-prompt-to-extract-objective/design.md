## Context

`createWebFetchTool` in `packages/tools-web/src/web-fetch.ts` currently:
1. Calls `parallel-web`'s `beta.extract()` to retrieve raw page content
2. Calls `generateText()` (Vercel AI SDK) with that content + user prompt to produce a focused answer

The `parallel-web` extract API already supports an `objective` field (`BetaExtractParams.objective`) that instructs the extractor to return only content relevant to the stated goal. Passing the prompt as `objective` makes step 2 redundant.

## Goals / Non-Goals

**Goals:**
- Eliminate the `generateText` round-trip in `createWebFetchTool`
- Pass user `prompt` as `objective` to `parallel-web` extract
- Return focused excerpts/content directly as the tool response
- Remove `model: LanguageModel` from `WebFetchConfig` (simplify API)

**Non-Goals:**
- Changing the tool's external schema (input remains `url` + `prompt`)
- Supporting other web providers beyond `parallel-web`
- Adding streaming or partial results

## Decisions

### 1. Use `objective` (not `search_queries`) for prompt forwarding

`BetaExtractParams` offers both `objective` (natural-language goal) and `search_queries` (keyword queries). The user's `prompt` is a natural-language instruction, making `objective` the correct fit. `search_queries` is for keyword-style retrieval.

### 2. Remove `model` from `WebFetchConfig`

With no `generateText` call, `LanguageModel` is no longer needed. Removing it simplifies the config and removes the `ai` SDK import from this file. Callers who currently pass `model` will get a TypeScript error (breaking change), but since the field was only used internally it is safe to remove in a minor release with a clear migration note.

### 3. Return extracted content as `response`

`WebFetchOutput.response` previously held AI-generated text. Post-change it will hold the extracted markdown content (full content or joined excerpts). The field semantics shift slightly but the shape is identical — no interface rename needed.

### 4. Prefer `full_content` with `objective` fallback to excerpts

Keep `full_content: true` and `excerpts: true` so the extractor returns the most focused content possible. The existing fallback (`full_content || excerpts?.join`) remains correct.

## Risks / Trade-offs

- **Output quality regression** → The extracted content focused by `objective` may be less polished than a dedicated `generateText` pass. Mitigation: `parallel-web`'s objective-aware extraction is designed for this use case; quality should be comparable for factual retrieval.
- **Breaking change on `WebFetchConfig.model`** → Callers must remove `model` from their config. Mitigation: TypeScript will surface the error at compile time; document in changelog.
- **`objective` length limits** → Very long prompts may be truncated by the API. Mitigation: The `prompt` field is already user-controlled; no additional guard is needed beyond what the API enforces.
