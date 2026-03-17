## 1. Inspect SDK Exports

- [x] 1.1 Check what `@e2b/code-interpreter` exports (the `Sandbox` class and its instance type) to confirm how to import and type it
- [x] 1.2 Check what `@vercel/sandbox` exports — inspect the actual `Sandbox` export shape (class vs factory, available instance methods) so types can be used directly without casting

## 2. Update Package Dependencies

- [x] 2.1 In `packages/sandbox-e2b/package.json`: move `@e2b/code-interpreter` from `peerDependencies` to `dependencies`; remove `@e2b/code-interpreter` from `peerDependenciesMeta`; keep it in `devDependencies` only if still needed for type-checking before the workspace link resolves
- [x] 2.2 In `packages/sandbox-vercel/package.json`: move `@vercel/sandbox` from `peerDependencies` to `dependencies`; remove `@vercel/sandbox` from `peerDependenciesMeta`; keep it in `devDependencies` only if still needed for type-checking

## 3. Simplify sandbox-e2b

- [x] 3.1 Add top-level static import at the top of `packages/sandbox-e2b/src/index.ts`: `import { Sandbox as E2BSandbox } from "@e2b/code-interpreter"`
- [x] 3.2 Remove the `let E2BSandboxSDK` variable declaration and the `try { const module = await import(...) } catch { ... }` block inside `getE2B()`
- [x] 3.3 Update `getE2B()` to call `E2BSandbox.connect()` and `E2BSandbox.create()` directly using the statically imported class
- [x] 3.4 Update type annotations in `getE2B()` to use `InstanceType<typeof E2BSandbox>` (or the SDK's inferred instance type) instead of `E2BSandboxInstance`
- [x] 3.5 Delete the `E2BSandboxSDKType` interface
- [x] 3.6 Delete the `E2BSandboxInstance` interface
- [x] 3.7 Run `pnpm typecheck` in `packages/sandbox-e2b` — fix any type errors

## 4. Simplify sandbox-vercel

- [x] 4.1 Add top-level static import at the top of `packages/sandbox-vercel/src/index.ts` based on what was found in task 1.2 (e.g., `import { Sandbox as VercelSandbox } from "@vercel/sandbox"`)
- [x] 4.2 Remove the `let VercelSandboxSDK` variable declaration and the `try { const module = await import(...) } catch { ... }` block inside `getSbx()`
- [x] 4.3 Update `getSbx()` to call `VercelSandbox.get()` and `VercelSandbox.create()` directly using the statically imported class/factory
- [x] 4.4 Update type annotations throughout `getSbx()` and usages to use SDK-native types — use `InstanceType<typeof VercelSandbox>` or equivalent; avoid `as unknown as` casts
- [x] 4.5 Delete the `VercelSandboxSDKType` interface
- [x] 4.6 Delete the `VercelSandboxInstance` interface
- [x] 4.7 Delete the `CommandResult` interface (if covered by SDK types)
- [x] 4.8 Run `pnpm typecheck` in `packages/sandbox-vercel` — fix any type errors

## 5. Fix Test Dynamic Imports

- [x] 5.1 In `packages/core/src/cache.test.ts`: add top-level static imports for `middleTruncate` from `./utils.js` and `composeStops` from `./agent.js`
- [x] 5.2 Remove the inline `await import()` calls from the test bodies and use the statically imported names instead

## 6. Verify

- [x] 6.1 Run `pnpm build` in `packages/sandbox-e2b` and confirm the build succeeds
- [x] 6.2 Run `pnpm build` in `packages/sandbox-vercel` and confirm the build succeeds
- [x] 6.3 Run `pnpm test` across the workspace and confirm all tests pass
