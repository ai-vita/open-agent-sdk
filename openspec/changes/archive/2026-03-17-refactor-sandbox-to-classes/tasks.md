## 1. Refactor sandbox-local

- [x] 1.1 Convert `createLocalSandbox` body into a `LocalSandbox` class that `implements Sandbox`, with `workingDirectory` as a private field
- [x] 1.2 Make `resolvePath` a `private` method on `LocalSandbox`
- [x] 1.3 Remove `createLocalSandbox`; keep `LocalSandboxConfig` and `LocalSandbox` as the only exports

## 2. Refactor sandbox-e2b

- [x] 2.1 Convert `createE2BSandbox` body into an `E2BSandbox` class that `implements Sandbox`, with `workingDirectory`, `timeout`, `sandboxId`, `e2bInstance`, and `initPromise` as private fields
- [x] 2.2 Make `getE2B()` a `private` async method on `E2BSandbox`
- [x] 2.3 Make `resolvePath` a `private` method on `E2BSandbox`
- [x] 2.4 Remove `createE2BSandbox`; keep `E2BSandboxConfig` and `E2BSandbox` as the only exports

## 3. Refactor sandbox-vercel

- [x] 3.1 Convert `createVercelSandbox` body into a `VercelSandbox` class that `implements Sandbox`, with `workingDirectory`, `timeout`, `sandboxId`, `sbxInstance`, `initPromise`, and `_rgPath` as private fields
- [x] 3.2 Make `getSbx()` a `private` async method on `VercelSandbox`
- [x] 3.3 Move `ensureRipgrep` to a `private` method on `VercelSandbox`
- [x] 3.4 Expose `rgPath` as `get`/`set` accessors backed by `_rgPath` on `VercelSandbox`
- [x] 3.5 Remove `createVercelSandbox`; keep `VercelSandboxConfig` and `VercelSandbox` as the only exports

## 4. Update call sites

- [x] 4.1 Update `examples/coding-agent/src/index.ts`: replace `createLocalSandbox(...)` with `new LocalSandbox(...)`
- [x] 4.2 Update `packages/sandbox-local/src/index.test.ts`: replace `createLocalSandbox(...)` with `new LocalSandbox(...)`
- [x] 4.3 Update `packages/sandbox-e2b/src/index.test.ts`: replace `await createE2BSandbox(...)` with `new E2BSandbox(...)`
- [x] 4.4 Update `packages/sandbox-vercel/src/index.test.ts`: replace `await createVercelSandbox(...)` with `new VercelSandbox(...)`

## 5. Verification

- [x] 5.1 Run `pnpm typecheck` and fix any type errors
- [x] 5.2 Run `pnpm test` and confirm no regressions
