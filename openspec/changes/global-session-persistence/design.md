## Design

### Session Path Resolution

A new helper function `resolveSessionPath(cwd, opts)` handles all session path logic:

```
resolveSessionPath(cwd: string, opts: { continue?: boolean, resume?: string })
  → { sessionPath: string, isNew: boolean }
```

**Algorithm:**

1. Compute `projectHash` = first 12 chars of `sha256(absoluteCwd)`
2. `sessionDir` = `~/.agents/sessions/<projectHash>/`
3. Ensure `sessionDir` exists, write/update `metadata.json` with `{ "path": absoluteCwd }`
4. Based on flags:
   - **No flag** → generate new timestamp filename, return `{ sessionPath, isNew: true }`
   - **`--continue`** → find most recent `.jsonl` in `sessionDir`, return it. If none exists, behave like no flag.
   - **`--resume <id>`** → find matching `.jsonl` by prefix match on timestamp. If no match, error. If no id given, list sessions and let user pick (interactive picker).

### Timestamp Format

Session files use filesystem-safe ISO timestamps:

```
YYYY-MM-DDTHH-MM-SS.jsonl
```

Generated via:
```ts
new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "") + ".jsonl"
```

### Session Listing (for `--resume` picker)

```
Sessions for /Users/lilac/work/my-project:
  1. 2026-03-18T14-15-22  (32 messages, 2.1 KB)
  2. 2026-03-18T10-30-00  (18 messages, 1.4 KB)
Select session [1]:
```

Message count derived by counting newlines in the file (cheap, no parsing needed).

### metadata.json

```json
{
  "path": "/Users/lilac/work/my-project"
}
```

Minimal — just maps hash back to path. No timestamps or session lists (the filesystem is the source of truth).

### File Layout

```
packages/cli/src/
  cli.ts              # modified: new flags, use resolveSessionPath()
  sessions.ts         # new: resolveSessionPath(), listSessions(), helpers
```

### Integration with cli.ts

```
Before:
  const SESSION_FILE = ".session.jsonl";
  const sessionPath = path.join(cwd, SESSION_FILE);
  if (flags.new) unlinkSync(sessionPath);

After:
  const { sessionPath, isNew } = resolveSessionPath(cwd, {
    continue: flags.continue,
    resume: flags.resume,
  });
```

The rest of `cli.ts` is unchanged — `SessionManager` still receives a file path.

### Edge Cases

- **First run ever**: `~/.agents/sessions/` doesn't exist → created automatically
- **`--continue` with no prior sessions**: starts fresh (no error)
- **`--resume` with invalid id**: error with helpful message listing available sessions
- **Hash collision**: extremely unlikely with 12-char hex (48 bits). `metadata.json` provides the real path for verification if needed.
- **Multiple projects with same hash**: check `metadata.json` path — if it doesn't match, use full hash or append a suffix. In practice this won't happen.
