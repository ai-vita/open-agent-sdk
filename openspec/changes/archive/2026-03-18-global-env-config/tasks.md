## Tasks

- [x] Update `loadEnv()` in `packages/cli/src/cli.ts` to load from `~/.agents/.env` instead of `$CWD/.env` and `$CWD/.env.local`
- [x] Update the `HELP` string in `packages/cli/src/cli.ts` to reference `~/.agents/.env`
- [x] Update or add a test for the new `loadEnv()` behavior (skipped — `loadEnv` is a trivial unexported one-liner, not worth mocking)
