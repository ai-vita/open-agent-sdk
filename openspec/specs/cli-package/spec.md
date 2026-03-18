## Requirements

### Requirement: CLI package exists as a workspace package
The system SHALL have a `packages/cli` package in the pnpm workspace with a `bin` field mapping the command name `oa` to the bundled entry point.

#### Scenario: Package is part of workspace
- **WHEN** `pnpm install` is run from the monorepo root
- **THEN** `packages/cli` is recognized as a workspace package

#### Scenario: Bin field is configured
- **WHEN** the `packages/cli/package.json` is inspected
- **THEN** it SHALL contain a `bin` field with `"oa"` pointing to `dist/cli.mjs`

### Requirement: CLI starts interactive chatbot session
The `oa` command SHALL start an interactive readline-based chat loop that sends user input to the agent and streams responses to stdout.

#### Scenario: Default invocation
- **WHEN** the user runs `oa` with no arguments
- **THEN** the CLI starts an interactive chat session in the current working directory
- **THEN** the agent has access to filesystem and shell tools scoped to the cwd

#### Scenario: Exit
- **WHEN** the user types `exit` or presses Ctrl+D
- **THEN** the CLI exits cleanly

### Requirement: Session persistence
The CLI SHALL persist chat sessions to a `.session.jsonl` file in the current working directory and resume automatically on next invocation.

#### Scenario: Resume session
- **WHEN** the user runs `oa` in a directory with an existing `.session.jsonl`
- **THEN** the previous session is loaded and the user sees a "Resumed session" message

#### Scenario: New session flag
- **WHEN** the user runs `oa --new`
- **THEN** any existing `.session.jsonl` is deleted and a fresh session starts

### Requirement: API key configuration
The CLI SHALL load API keys from environment variables, with `.env.local` in the cwd taking precedence.

#### Scenario: Key from .env.local
- **WHEN** a `.env.local` file in the cwd contains `AI_GATEWAY_API_KEY=sk-xxx`
- **THEN** the CLI uses that key for API requests

#### Scenario: Key from environment
- **WHEN** no `.env.local` exists but `AI_GATEWAY_API_KEY` is set in the shell
- **THEN** the CLI uses the shell environment value

### Requirement: Global installability
The CLI package SHALL be installable globally via `npm i -g @open-agent-sdk/cli` or `pnpm add -g @open-agent-sdk/cli`, making the `oa` command available system-wide.

#### Scenario: Global install
- **WHEN** `npm i -g @open-agent-sdk/cli` is run
- **THEN** the `oa` command is available in the user's PATH
- **THEN** running `oa` from any directory starts the agent in that directory

### Requirement: Help and version flags
The CLI SHALL support `--help` and `--version` flags.

#### Scenario: Help flag
- **WHEN** the user runs `oa --help`
- **THEN** usage information is printed and the CLI exits

#### Scenario: Version flag
- **WHEN** the user runs `oa --version`
- **THEN** the package version is printed and the CLI exits
