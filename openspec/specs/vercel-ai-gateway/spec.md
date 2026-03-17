# vercel-ai-gateway Specification

## Purpose
TBD - created by archiving change env-and-ai-gateway-setup. Update Purpose after archive.
## Requirements
### Requirement: Route all model calls through Vercel AI Gateway
The coding agent example SHALL use Vercel's AI Gateway as the model provider instead of calling the Anthropic API directly. The gateway SHALL be configured via an `AI_GATEWAY_API_KEY` environment variable loaded from `.env.local`.

#### Scenario: Agent runs successfully via the gateway
- **WHEN** `AI_GATEWAY_API_KEY` is set and the gateway is reachable
- **THEN** the agent SHALL complete its task, with all LLM calls routed through `https://ai-gateway.vercel.sh/v1`

#### Scenario: Missing gateway token fails with a clear error
- **WHEN** `AI_GATEWAY_API_KEY` is not set
- **THEN** the model provider construction SHALL fail or the first API call SHALL return an authentication error, and the agent SHALL surface this error to the user rather than silently proceeding

### Requirement: Gateway provider uses the native `gateway()` function from `ai`
The gateway integration SHALL use the `gateway()` function exported from the `ai` package (Vercel AI SDK). No additional provider package (e.g., `@ai-sdk/openai-compatible`) is required. The model identifier SHALL use the `<provider>/<model>` format (e.g., `anthropic/claude-sonnet-4.6`).

#### Scenario: Model is constructed via gateway()
- **WHEN** the agent initializes its model
- **THEN** it SHALL call `gateway('anthropic/claude-sonnet-4.6')` and pass the result to `runAgent`

#### Scenario: Model identifier routes to the correct upstream model
- **WHEN** the model string `anthropic/claude-sonnet-4.6` is passed to `gateway()`
- **THEN** the gateway SHALL forward the request to Anthropic's `claude-sonnet-4.6` model

### Requirement: Package dependencies are updated
The `examples/coding-agent/package.json` SHALL declare `dotenv` as a new dependency. The `@ai-sdk/anthropic` and `@open-agent-sdk/provider-anthropic` dependencies SHALL be removed as they are no longer used.

#### Scenario: Fresh install has all required packages
- **WHEN** `pnpm install` is run in `examples/coding-agent`
- **THEN** `dotenv` SHALL be available for import and no unused provider packages SHALL remain

