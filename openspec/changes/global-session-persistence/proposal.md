## Why

The `oa` CLI stores sessions as a single `.session.jsonl` in the project directory ([cli.ts:27](packages/cli/src/cli.ts#L27)). `--new` deletes the old session before starting a fresh one ([cli.ts:94-97](packages/cli/src/cli.ts#L94-L97)). This has several problems:

- **History is lost** — `--new` destroys the previous session with no way to recover it
- **Pollutes the project** — `.session.jsonl` sits in the user's repo, needs `.gitignore` entries
- **No multi-session support** — only one session per project at a time
- **No resume/continue workflow** — can't pick up a specific past session

Other coding CLIs (Claude Code, Aider, Cline) all persist sessions outside the project directory with multi-session support.

## What Changes

1. **Move session storage to `~/.agents/sessions/<project-hash>/`** — consistent with existing `~/.agents/.env` and `~/.agents/skills/` conventions
2. **Default to fresh sessions** — `oa` starts a new session each invocation (matching Claude Code's behavior)
3. **Add `--continue` / `-c`** — resume the most recent session for the current project
4. **Add `--resume` / `-r [id]`** — resume a specific session by timestamp or show a picker
5. **Remove `--new` flag** — no longer needed since fresh is the default
6. **Remove `.session.jsonl` from project directory** — sessions are global

## Session Storage Layout

```
~/.agents/
  .env                                  # existing
  skills/                               # existing
  sessions/
    <sha256-prefix-12>/                 # 12-char hash of absolute cwd
      metadata.json                     # { "path": "/abs/path/to/project" }
      2026-03-18T10-30-00.jsonl         # session files, named by timestamp
      2026-03-18T14-15-22.jsonl
```

- Timestamps use filesystem-safe ISO format (colons replaced with dashes)
- `metadata.json` maps the hash back to the human-readable project path
- `SessionManager` itself is unchanged — it already takes an arbitrary file path

## CLI Flags (After)

```
oa                          # new session (auto-saved)
oa -c / --continue          # resume most recent session for this project
oa -r / --resume [id]       # resume specific session or show picker
```

## Scope

- Add session path resolution logic to `packages/cli/src/cli.ts` (small helper function)
- Remove `--new` flag and `.session.jsonl` constant
- Add `--continue` and `--resume` flags
- No changes to `packages/core/src/session/` — `SessionManager` is storage-agnostic
