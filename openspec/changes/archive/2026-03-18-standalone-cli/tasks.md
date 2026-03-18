## 1. Package Scaffolding

- [x] 1.1 Create `packages/cli/` directory with `package.json` (name: `@open-agent-sdk/cli`, bin: `oa` → `dist/cli.mjs`, dependencies on workspace packages, `ai`, `zod`, `dotenv`)
- [x] 1.2 Add `packages/cli` to `pnpm-workspace.yaml` if not auto-discovered
- [x] 1.3 Create `packages/cli/tsconfig.json` extending the root config

## 2. CLI Entry Point

- [x] 2.1 Create `packages/cli/src/cli.ts` with argument parsing (`--help`, `--version`, `--new`, `--model`) using `node:util.parseArgs`
- [x] 2.2 Implement the interactive chatbot loop (readline, streaming, session persistence) — extract and adapt from `examples/coding-agent/src/chatbot.ts`
- [x] 2.3 Load `.env.local` from cwd for API key configuration
- [x] 2.4 Print help text with usage instructions when `--help` is passed
- [x] 2.5 Print package version from `package.json` when `--version` is passed

## 3. Build Configuration

- [x] 3.1 Create `packages/cli/tsup.config.ts` — single ESM output, shebang banner (`#!/usr/bin/env node`), `noExternal` to inline all workspace deps
- [x] 3.2 Add `build` script to `package.json` (`tsup`)
- [x] 3.3 Add `compile` script to `package.json` (`bun build src/cli.ts --compile --outfile dist/oa`)
- [x] 3.4 Verify `pnpm --filter @open-agent-sdk/cli build` produces a working `dist/cli.mjs`

## 4. Testing

- [x] 4.1 Create `packages/cli/src/cli.test.ts` — test argument parsing (help, version, new flags)
- [x] 4.2 Manually verify `node dist/cli.mjs --help` and `node dist/cli.mjs --version` work after build

## 5. Documentation

- [x] 5.1 Update root `CLAUDE.md` to document the CLI package and `oa` command
- [x] 5.2 Add install/usage instructions to `packages/cli/package.json` description
