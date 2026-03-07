## Why

The `createWebFetchTool` currently makes two sequential AI calls: one to extract web content via `parallel-web`, and a second `generateText` call to process that content with the user's prompt. The `parallel-web` extract API natively supports an `objective` parameter that focuses extracted content on a specific goal — passing the prompt there eliminates the second AI call entirely, reducing latency and cost.

## What Changes

- Pass the user-supplied `prompt` as the `objective` parameter in the `parallel-web` `extract()` call
- Remove the downstream `generateText` call and the `LanguageModel` dependency from `createWebFetchTool`
- Return the extracted (and now prompt-focused) content directly as the tool response
- Simplify `WebFetchConfig` — `model` and `apiKey` for the AI model are no longer needed; only the `parallel-web` `apiKey` remains

## Capabilities

### New Capabilities

- `web-fetch`: Core web fetch tool that extracts focused content from a URL using `parallel-web`'s `objective` parameter, returning the result without a second-pass AI generation step

### Modified Capabilities

<!-- No existing specs to delta -->

## Impact

- **`packages/tools-web/src/web-fetch.ts`**: Primary change — simplify `execute`, remove `generateText`, add `objective` to extract call
- **`WebFetchConfig`**: Remove `model: LanguageModel` field (potentially breaking for callers who pass it)
- **`WebFetchOutput`**: `response` field now contains extracted text rather than AI-generated text; `final_url` still populated
- **Dependencies**: `ai` package import (`generateText`, `LanguageModel`) can be removed from this file; `zod`/`zodSchema` stays
- **`parallel-web`**: No version change needed; `objective` field already exists in current API (`BetaExtractParams.objective`)
