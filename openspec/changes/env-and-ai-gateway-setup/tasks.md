## 1. Dependencies

- [x] 1.1 Add `dotenv` to `examples/coding-agent/package.json` dependencies
- [x] 1.2 Remove `@ai-sdk/anthropic` and `@open-agent-sdk/provider-anthropic` from `examples/coding-agent/package.json` (replaced by native `gateway()` from `ai`)
- [x] 1.3 Run `pnpm install` in the monorepo root to update the lockfile

## 2. Git Hygiene

- [x] 2.1 Create `examples/coding-agent/.gitignore` with a single entry: `.env.local`

## 3. Environment File Setup

- [x] 3.1 Create `examples/coding-agent/.env` (committed) with `AI_GATEWAY_API_KEY=` and a brief comment explaining that the real value goes in `.env.local`
- [x] 3.2 Create local `examples/coding-agent/.env.local` (not committed) with the actual `AI_GATEWAY_API_KEY=<real_token>` value

## 4. Source Code Changes

- [x] 4.1 At the top of `examples/coding-agent/src/index.ts`, add dotenv loading: `import 'dotenv/config'` (loads `.env`) followed by `dotenv.config({ path: '.env.local', override: true })` (loads `.env.local`), before any other imports that consume `process.env`
- [x] 4.2 Replace the model setup with `gateway('anthropic/claude-sonnet-4.6')` from `ai` — remove `createAnthropic`, `wrapLanguageModel`, and `anthropicPromptCacheMiddleware`
- [x] 4.3 Remove unused imports: `createAnthropic` from `@ai-sdk/anthropic`, `wrapLanguageModel` from `ai`, `anthropicPromptCacheMiddleware` from `@open-agent-sdk/provider-anthropic`
- [x] 4.4 Update the top-of-file comment block: remove mention of `@open-agent-sdk/provider-anthropic`; update run instructions to reference `.env.local` instead of shell env vars

## 5. Verification

- [x] 5.1 Run `pnpm typecheck` in `examples/coding-agent` and confirm no TypeScript errors
- [ ] 5.2 Run the agent with a simple task (e.g., `pnpm start "List files in current directory"`) and confirm it completes successfully via the gateway
