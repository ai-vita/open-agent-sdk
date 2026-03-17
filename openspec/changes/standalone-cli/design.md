## Context

The chatbot example in `examples/coding-agent/` demonstrates a working interactive agent but is only runnable via `pnpm --filter ... chatbot` from the monorepo root. Users want a CLI tool they can install globally and invoke from any directory, similar to `claude`.

The JavaScript ecosystem offers several approaches for standalone distribution:
- **npm `bin` field** — standard way to create CLI commands installable via `npm i -g`
- **`bun build --compile`** — compiles to a self-contained executable (no runtime needed)
- **Node.js SEA (Single Executable Applications)** — embeds script into the Node binary (available since Node 20+)
- **`pkg`** — deprecated/unmaintained since 2023, not viable

## Goals / Non-Goals

**Goals:**
- Create a `packages/cli` package with a `bin` entry that provides the `oa` command
- Support `npm i -g @open-agent-sdk/cli` / `pnpm add -g` for global installation
- Bundle into a single JS file (via `tsup`) so it works standalone after install
- Provide a `compile` script using `bun build --compile` for true standalone binaries
- Maintain feature parity with the existing chatbot example (session persistence, compaction, streaming)
- Support `.env` / `.env.local` in the working directory for API key configuration

**Non-Goals:**
- GUI or TUI framework (keep it simple readline-based like the current chatbot)
- Plugin system or extensibility hooks (future work)
- Auto-update mechanism
- Publishing to package registries (just make it possible; actual publishing is a separate effort)
- Windows-specific installer (`.msi`, `.exe` wrapper)

## Decisions

### 1. New `packages/cli` package (not modifying the example)

The example stays as a reference. The CLI package is a proper, publishable package with its own `package.json`, `bin` field, and build config. This keeps concerns separated — examples teach, CLI ships.

**Alternative considered**: Adding `bin` to the example package. Rejected because examples are `"private": true` and mixing example/distribution concerns is messy.

### 2. `tsup` for bundling (single-file output)

Already used across the monorepo. Configure with `banner` to inject shebang (`#!/usr/bin/env node`), `noExternal` to inline workspace deps, and `format: ["esm"]` (single format for CLI). This produces a single `dist/cli.mjs` that works with just a Node.js runtime.

**Alternative considered**: `esbuild` directly. Rejected because `tsup` wraps esbuild and is already the project standard.

### 3. `bun build --compile` for standalone binary

Bun's compile produces a single executable (~50MB) that includes the Bun runtime. It's the simplest path to a zero-dependency binary. Add a `"compile"` script in `package.json`:
```
"compile": "bun build src/cli.ts --compile --outfile dist/oa"
```

**Alternative considered**: Node.js SEA. More complex setup (requires `postject`, `--experimental-sea-config`, code signing on macOS). Bun compile is a single command. We can add Node SEA support later if needed.

### 4. `node:util.parseArgs` for argument parsing

Built into Node.js 18+, zero dependencies. The CLI has minimal args (`--new`, `--model`, `--help`, `--version`). No need for a third-party parser.

**Alternative considered**: `citty`, `commander`, `yargs`. Overkill for 3-4 flags.

### 5. API key via environment variable

Use `AI_GATEWAY_API_KEY` (matching existing example) loaded from `.env.local` in cwd or from the shell environment. No interactive key setup flow.

## Risks / Trade-offs

- **Bun compile binary size (~50MB)**: Acceptable for a developer tool. Users who want smaller can use `npm i -g` instead. → Mitigation: document both installation methods.
- **Bun compile may not support all Node.js APIs**: The chatbot uses standard APIs (fs, readline, path). Risk is low. → Mitigation: test the compiled binary in CI.
- **Workspace deps must be inlined for global install**: `tsup` with `noExternal` handles this, but transitive native deps (if any) could break. → Mitigation: the current dependency tree is pure JS, no native modules.
