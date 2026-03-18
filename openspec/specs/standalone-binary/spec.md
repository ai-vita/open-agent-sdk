## Requirements

### Requirement: Bun compile script
The `packages/cli` package SHALL include a `compile` script that uses `bun build --compile` to produce a standalone executable.

#### Scenario: Compile to binary
- **WHEN** `pnpm --filter @open-agent-sdk/cli compile` is run (with Bun installed)
- **THEN** a standalone executable is produced at `dist/oa` (or `dist/oa.exe` on Windows)
- **THEN** the binary runs without requiring Node.js or Bun to be installed

#### Scenario: Binary feature parity
- **WHEN** the standalone binary is executed
- **THEN** it SHALL behave identically to `oa` installed via npm, including session persistence, streaming, and tool access

### Requirement: Bundled single-file output
The `packages/cli` build process SHALL produce a single bundled JS file with all workspace dependencies inlined, so the CLI works without the monorepo's `node_modules`.

#### Scenario: tsup bundle
- **WHEN** `pnpm --filter @open-agent-sdk/cli build` is run
- **THEN** `dist/cli.mjs` is produced containing all application code
- **THEN** the file starts with a `#!/usr/bin/env node` shebang

#### Scenario: No workspace imports at runtime
- **WHEN** the bundled `dist/cli.mjs` is inspected
- **THEN** it SHALL NOT contain `require("@open-agent-sdk/...")` or `import ... from "@open-agent-sdk/..."` — all workspace deps are inlined
