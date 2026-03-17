# env-loading Specification

## Purpose

Load .env and .env.local files at agent startup to supply API keys and local configuration without requiring shell-level environment variable exports.

## Requirements
### Requirement: Load environment variables from local dotenv files
The coding agent example SHALL load environment variables from `.env` and `.env.local` files at process startup, before any SDK or provider initialization occurs. `.env.local` values SHALL override `.env` values for the same key.

#### Scenario: Key present in .env.local is available at runtime
- **WHEN** `.env.local` exists with `AI_GATEWAY_API_KEY=<real_token>`
- **THEN** `process.env.AI_GATEWAY_API_KEY` SHALL be set to that value before any provider is constructed

#### Scenario: .env.local overrides .env
- **WHEN** `.env` contains `AI_GATEWAY_API_KEY=` (empty placeholder) and `.env.local` contains `AI_GATEWAY_API_KEY=real_token`
- **THEN** `process.env.AI_GATEWAY_API_KEY` SHALL equal `real_token`

#### Scenario: Missing dotenv files do not crash the agent
- **WHEN** neither `.env` nor `.env.local` exists
- **THEN** the agent SHALL start normally, relying on any pre-existing shell environment variables

### Requirement: `.env` is committed as documentation; `.env.local` holds secrets
The `.env` file SHALL be committed to version control containing only placeholder values (e.g. `AI_GATEWAY_API_KEY=`). The `.env.local` file SHALL be listed in `.gitignore` and SHALL never be committed.

#### Scenario: .env.local is gitignored
- **WHEN** a developer runs `git status` after creating `.env.local`
- **THEN** the file SHALL appear as ignored and NOT as a file to be staged

#### Scenario: .env is tracked by git
- **WHEN** a developer runs `git status` after modifying `.env`
- **THEN** `.env` SHALL appear as a tracked, stageable file (not ignored)

