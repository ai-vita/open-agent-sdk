## Context

The coding agent example (`examples/coding-agent`) currently requires API keys as shell environment variables. Model calls go directly to Anthropic via `@ai-sdk/anthropic`. The user wants two changes:

1. **Local `.env` / `.env.local` file loading** — developer convenience; keys live in files instead of the shell session.
2. **Vercel AI Gateway** — all model calls route through Vercel's unified AI proxy instead of hitting the Anthropic API directly. The gateway key is stored in `.env.local` (not committed).

The Vercel AI SDK (`ai` package) is already a dependency. Per the [official AI Gateway docs](https://vercel.com/docs/ai-gateway/getting-started/text), the gateway integrates natively with the `ai` package: when `AI_GATEWAY_API_KEY` is set in the environment, model strings like `'anthropic/claude-sonnet-4.6'` can be passed directly to `streamText` / `generateText` without instantiating a separate provider. Alternatively, the OpenAI-compatible path works via `baseURL: 'https://ai-gateway.vercel.sh/v1'` with `apiKey: process.env.AI_GATEWAY_API_KEY`.

## Goals / Non-Goals

**Goals:**
- Load `.env` then `.env.local` at startup (`.env.local` overrides `.env`).
- Replace direct Anthropic provider with a Vercel AI Gateway–routed model.
- Drop `anthropicPromptCacheMiddleware` and `@open-agent-sdk/provider-anthropic` (not applicable to the `gateway()` model).
- Keep changes isolated to the `examples/coding-agent` directory.

**Non-Goals:**
- Changing any core SDK packages.
- Supporting multiple gateway providers or runtime switching.
- Building a generic env-loader utility for the whole monorepo.

## Decisions

### 1. Dotenv loading: `dotenv` package, side-effect import style

Use the [`dotenv`](https://github.com/motdotla/dotenv) package, which is also the approach in the official AI Gateway quickstart. Load `.env` via the side-effect import `import 'dotenv/config'`, then explicitly load `.env.local` with `dotenv.config({ path: '.env.local', override: true })` so that local secrets override base defaults. Both calls go at the very top of `index.ts` before any SDK imports that consume `process.env`.

**Alternatives considered:**
- Native Node `--env-file` flag (Node ≥ 20): no dependency, but doesn't support `.env.local` override layering and adds friction with `tsx`.
- `dotenv-flow`: handles layering automatically, but adds more weight for a simple two-file case.

### 2. Vercel AI Gateway provider: native `gateway()` from `ai`

Per the [official docs](https://vercel.com/docs/ai-gateway/getting-started/text), the `ai` package (Vercel AI SDK) has built-in AI Gateway support. When `AI_GATEWAY_API_KEY` is in the environment, the `gateway()` function exported from `ai` constructs a `LanguageModel` directly — no extra provider package required.

```ts
import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import { gateway } from 'ai';

const model = gateway('anthropic/claude-sonnet-4.6');
```

**Alternatives considered:**
- `@ai-sdk/openai-compatible` with `baseURL: 'https://ai-gateway.vercel.sh/v1'`: works but requires an extra package; the native `gateway()` is simpler.
- `@ai-sdk/anthropic` direct: bypasses gateway observability entirely.

### 3. Prompt-caching middleware: drop

`anthropicPromptCacheMiddleware` is specific to `@ai-sdk/anthropic` and injects Anthropic cache-control headers. It is not meaningful when the model is supplied by `gateway()` via the Vercel AI SDK. Remove it along with `@open-agent-sdk/provider-anthropic` and `wrapLanguageModel`.

### 4. Env file conventions

Following the Next.js/Vercel convention:

| File | Committed? | Contains |
|---|---|---|
| `.env` | ✅ Yes | `AI_GATEWAY_API_KEY=` (empty placeholder — documents the required variable) |
| `.env.local` | ❌ No | `AI_GATEWAY_API_KEY=<real_token>` (actual secret, overrides `.env`) |

Only `.env.local` is gitignored. `.env` serves as living documentation of what keys are needed.

## Risks / Trade-offs

- **Gateway latency overhead** → Mitigation: gateway is co-located with Vercel infra; overhead is typically negligible.
- **`gateway()` API surface may not expose all Anthropic-specific features** (extended thinking, etc.) → Mitigation: the example only needs basic chat completions.
- **Dropping prompt-caching middleware** removes cost savings on repeated runs → Mitigation: documented trade-off; not applicable with the `gateway()` model anyway.
- **`.env.local` accidentally committed** → Mitigation: add `.env.local` to the example's `.gitignore`; `.env` is safe to commit as it contains only placeholders.
