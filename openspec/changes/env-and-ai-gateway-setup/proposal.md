## Why

The example coding agent currently requires API keys to be passed as environment variables at the shell level (e.g., `ANTHROPIC_API_KEY=... pnpm start`), which is inconvenient for local development. Additionally, the agent calls the Anthropic API directly, whereas the preferred setup uses Vercel's AI Gateway — a unified proxy layer that supports multiple providers, offers observability, and integrates cleanly with the Vercel AI SDK.

## What Changes

- Add `dotenv` loading to the coding agent example at startup: `import 'dotenv/config'` for `.env`, then `dotenv.config({ path: '.env.local', override: true })` for local overrides — matching the pattern used in Vercel's official AI Gateway quickstart.
- Store the Vercel AI Gateway API key (`AI_GATEWAY_API_KEY`) in `.env.local`, which is not committed to source control.
- Replace the direct `@ai-sdk/anthropic` provider with the native `gateway()` function from the `ai` package (Vercel AI SDK), which routes calls through the gateway automatically when `AI_GATEWAY_API_KEY` is set. No additional provider package required.
- Remove `@open-agent-sdk/provider-anthropic` and `wrapLanguageModel` (prompt-caching middleware is not applicable to the gateway model).
- Update `package.json` to add `dotenv`; remove `@ai-sdk/anthropic` and `@open-agent-sdk/provider-anthropic`.
- Update inline comments to document the new setup.

## Capabilities

### New Capabilities

- `env-loading`: Load `.env` and `.env.local` files at agent startup to supply API keys and local configuration without shell-level exports.
- `vercel-ai-gateway`: Configure the coding agent to route all model calls through Vercel's AI Gateway instead of calling the Anthropic API directly.

### Modified Capabilities

<!-- No existing spec-level capabilities are changing. -->

## Impact

- **`examples/coding-agent/src/index.ts`**: Dotenv loading added at top; model instantiation switches from `createAnthropic` + `wrapLanguageModel` to `gateway('anthropic/claude-sonnet-4.6')`.
- **`examples/coding-agent/package.json`**: Add `dotenv`; remove `@ai-sdk/anthropic` and `@open-agent-sdk/provider-anthropic`.
- **`examples/coding-agent/.env`**: New committed file with `AI_GATEWAY_API_KEY=` placeholder (documents required variables).
- **`examples/coding-agent/.gitignore`**: Ignores only `.env.local` (the real secrets file).
- No changes to core SDK packages — this is entirely within the example.
