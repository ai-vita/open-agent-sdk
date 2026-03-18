## Tasks

- [x] **Create `packages/cli/src/sessions.ts`** — session path resolution module
  - `resolveSessionPath(cwd, opts)` function
  - `listSessions(cwd)` function for interactive picker
  - `getSessionDir(cwd)` helper (hash computation, dir creation, metadata.json)
  - Timestamp filename generation

- [x] **Update CLI flags in `packages/cli/src/cli.ts`**
  - Remove `--new` flag and `SESSION_FILE` constant
  - Add `--continue` / `-c` (boolean) flag
  - Add `--resume` / `-r` (string, optional) flag
  - Wire flags into `resolveSessionPath()`

- [x] **Update session lifecycle in `cli.ts`**
  - Replace hardcoded session path with `resolveSessionPath()` call
  - Remove `unlinkSync` deletion logic
  - Update "resumed" console message to show session timestamp
  - Update help text (`HELP` constant)

- [x] **Add interactive session picker for bare `--resume`**
  - List sessions with message count and size
  - Use `readline` (already imported) for selection
  - Handle empty session list gracefully

- [x] **Write tests for `packages/cli/src/sessions.test.ts`**
  - `resolveSessionPath` returns new path by default
  - `--continue` returns most recent session
  - `--resume <id>` matches by timestamp prefix
  - `--resume` with no sessions behaves like fresh
  - Hash is deterministic for same cwd
  - `metadata.json` written correctly
