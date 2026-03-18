## Why

The `oa` CLI loads `.env` and `.env.local` from the current working directory ([cli.ts:28-31](packages/cli/src/cli.ts#L28-L31)). Since `oa` is designed to run from any directory, this is problematic:

- **Unpredictable**: different directories may have different `.env` files, leading to inconsistent behavior
- **Security risk**: a malicious `.env` in any directory could inject environment variables
- **Unnecessary indirection**: users who want to override config can set env vars directly in their shell

Other coding CLIs (Claude Code, Codex, Aider, Gemini CLI) all support a **global config home** rather than relying solely on project-level dotenv files.

## What Changes

1. **Replace project-level `.env` loading with global `~/.agents/.env`** — a single, predictable location consistent with the existing `~/.agents/skills/` convention
2. **Remove `.env.local` loading entirely** — env var overrides from the shell are sufficient
3. **Keep config in CLI, not core** — env loading is an application concern, not a library concern

## Config Resolution Order

```
1. CLI flags (--model, etc.)         ← highest priority
2. Environment variables (from shell)
3. ~/.agents/.env                    ← global defaults
```

No project-level `.env` loading. No structured config file (YAML/TOML) for now — `.env` is sufficient.

## Scope

- Modify `loadEnv()` in `packages/cli/src/cli.ts`
- No changes to `packages/core` or other packages
- The example coding-agent manages its own env loading independently

## Non-goals

- Structured config file (YAML/TOML) — may add later, not needed now
- OS keychain integration
- Project-level config overrides
