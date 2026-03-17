## 1. Update tsconfig for project references

- [x] 1.1 Add `"composite": true` to `tsconfig.base.json` compilerOptions
- [x] 1.2 Add `"composite": true` to each package's `tsconfig.json` (all 8 packages)
- [x] 1.3 Add `references` to packages that depend on `core`: tools, tools-web, skills, sandbox-local, sandbox-e2b, sandbox-vercel, sandbox-memory (each references `../core`)
- [x] 1.4 Create root `tsconfig.json` with project references to all 8 packages (separate from `tsconfig.base.json`)

## 2. Update package.json exports to source-first

- [x] 2.1 Update `packages/core/package.json`: set exports to `./src/index.ts`, add `publishConfig.exports` pointing to `dist/`
- [x] 2.2 Update remaining 7 packages' `package.json` with the same source-first exports and `publishConfig` pattern
- [x] 2.3 Remove top-level `main`, `module`, `types` fields from each package.json (superseded by `exports`)

## 3. Verify

- [x] 3.1 Run `pnpm typecheck` across all packages — ensure no errors
- [x] 3.2 Run `pnpm build` — ensure tsup still produces correct dist output
- [x] 3.3 Run `pnpm test` — ensure all tests pass
- [x] 3.4 Verify `pnpm pack --dry-run` on one package shows correct publishConfig resolution
