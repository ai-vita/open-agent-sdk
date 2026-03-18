## Env Loading

### Behavior

- On startup, `oa` loads `~/.agents/.env` using `dotenv.config()`
- `dotenv` default behavior: does NOT override existing env vars → shell env vars take precedence
- If `~/.agents/.env` does not exist, silently continue (no error, no warning)

### Precedence (highest to lowest)

1. CLI flags (`--model`)
2. Shell environment variables
3. `~/.agents/.env` file

### Path Resolution

- Use `os.homedir()` + `.agents/.env` (same pattern as skill discovery's `~/.agents/skills/`)
- No `~` expansion needed — construct absolute path directly

### Help Text

- Update CLI `HELP` string to reference `~/.agents/.env` instead of `.env.local`
- Document that env vars override the file
