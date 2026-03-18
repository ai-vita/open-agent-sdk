## Context

The `oa` CLI currently calls `dotenv.config()` twice in `loadEnv()` — once for `$CWD/.env` and once for `$CWD/.env.local`. Since `oa` runs from any directory, this is unpredictable and unnecessary. The `~/.agents/` directory is already established as the global agent home (used by skill discovery).

## Goals / Non-Goals

**Goals:**
- Load env vars from a single global location: `~/.agents/.env`
- Maintain CLI flag and shell env var precedence over file-based config

**Non-Goals:**
- Structured config files (YAML/TOML)
- Project-level env overrides
- Changes to core SDK or other packages

## Decisions

### 1. Single global `.env` at `~/.agents/.env`

**Rationale:** Reuses the existing `~/.agents/` convention from skill discovery. One file, one location, no ambiguity. `dotenv` with `override: false` (default) means shell env vars take precedence — users can always override without touching the file.

**Alternatives considered:**
- `~/.config/oa/.env` (XDG-compliant) — more standard on Linux but adds a new directory; `~/.agents/` already exists
- `~/.oa/.env` — tool-specific dir; less cohesive with the cross-agent `~/.agents/` convention
- Keep project-level `.env` — rejected for security and predictability reasons

### 2. No `.env.local` support

**Rationale:** The `.env` / `.env.local` split exists for committing defaults vs. gitignoring secrets. `~/.agents/.env` is already a personal file not in any repo — no need for a second layer.

### 3. `loadEnv()` stays in CLI package

**Rationale:** Env loading is an application concern. The SDK core should not mutate `process.env`. Each app (CLI, examples) handles its own config source.

## Risks / Trade-offs

- **[Breaking change]** Users with `$CWD/.env` files for `oa` will need to move config to `~/.agents/.env` or set env vars in their shell → Document in CLI help text and changelog
- **[Missing dir]** `~/.agents/` may not exist yet → `dotenv` silently ignores missing files, no issue
