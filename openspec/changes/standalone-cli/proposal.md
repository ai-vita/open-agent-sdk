## Why

The chatbot agent can only be run via `pnpm --filter ... chatbot` from within the monorepo. Users cannot install and run it globally from any directory like `claude` or other CLI tools. This limits adoption and usability — a coding agent should be invocable from anywhere in the terminal.

## What Changes

- Create a new **`packages/cli`** package that wraps the chatbot as a globally-installable CLI binary.
- Add a `bin` field in `package.json` so `npm i -g @open-agent-sdk/cli` (or `pnpm add -g`) makes the `oa` command available system-wide.
- Bundle the CLI into a single file using `tsup` (already used by the monorepo) so it works without needing workspace dependencies at runtime.
- Add a `bun build --compile` script for producing a true standalone binary (no runtime required) for distribution.
- The CLI runs the coding agent in the current working directory with session persistence, just like the existing chatbot example.

## Capabilities

### New Capabilities
- `cli-package`: A new `packages/cli` package providing a globally-installable `oa` CLI command with argument parsing, env config, and the interactive chatbot loop.
- `standalone-binary`: Build scripts for producing standalone single-file executables via `bun build --compile` and/or Node.js SEA (Single Executable Applications).

### Modified Capabilities
(none — no existing spec requirements change)

## Impact

- **New package**: `packages/cli` added to pnpm workspace.
- **Dependencies**: Adds a CLI argument parser (e.g., `citty` or built-in `node:util.parseArgs`). `tsup` already available for bundling.
- **Build**: New `pnpm --filter cli build` step; optional `pnpm --filter cli compile` for standalone binary.
- **Distribution**: Package publishable to npm; standalone binary attachable to GitHub releases.
- **No breaking changes** to existing packages or examples.
