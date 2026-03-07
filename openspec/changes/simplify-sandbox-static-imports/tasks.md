## 1. Inspect SDK Exports

- [ ] 1.1 Check what `@e2b/code-interpreter` exports (the `Sandbox` class and its instance type) to confirm how to import and type it
- [ ] 1.2 Check what `@vercel/sandbox` exports — inspect the actual `Sandbox` export shape (class vs factory, available instance methods) so types can be used directly without casting

## 2. Update Package Dependencies

- [ ] 2.1 In `packages/sandbox-e2b/package.json`: move `@e2b/code-interpreter` from `peerDependencies` to `dependencies`; remove `@e2b/code-interpreter` from `peerDependenciesMeta`; keep it in `devDependencies` only if still needed for type-checking before the workspace link resolves
- [ ] 2.2 In `packages/sandbox-vercel/package.json`: move `@vercel/sandbox` from `peerDependencies` to `dependencies`; remove `@vercel/sandbox` from `peerDependenciesMeta`; keep it in `devDependencies` only if still needed for type-checking

## 3. Simplify sandbox-e2b

- [ ] 3.1 Add top-level static import at the top of `packages/sandbox-e2b/src/index.ts`: `import { Sandbox as E2BSandbox } from "@e2b/code-interpreter"`
- [ ] 3.2 Remove the `let E2BSandboxSDK` variable declaration and the `try { const module = await import(...) } catch { ... }` block inside `getE2B()`
- [ ] 3.3 Update `getE2B()` to call `E2BSandbox.connect()` and `E2BSandbox.create()` directly using the statically imported class
- [ ] 3.4 Update type annotations in `getE2B()` to use `InstanceType<typeof E2BSandbox>` (or the SDK's inferred instance type) instead of `E2BSandboxInstance`
- [ ] 3.5 Delete the `E2BSandboxSDKType` interface
- [ ] 3.6 Delete the `E2BSandboxInstance` interface
- [ ] 3.7 Run `pnpm typecheck` in `packages/sandbox-e2b` — fix any type errors

## 4. Simplify sandbox-vercel

- [ ] 4.1 Add top-level static import at the top of `packages/sandbox-vercel/src/index.ts` based on what was found in task 1.2 (e.g., `import { Sandbox as VercelSandbox } from "@vercel/sandbox"`)
- [ ] 4.2 Remove the `let VercelSandboxSDK` variable declaration and the `try { const module = await import(...) } catch { ... }` block inside `getSbx()`
- [ ] 4.3 Update `getSbx()` to call `VercelSandbox.get()` and `VercelSandbox.create()` directly using the statically imported class/factory
- [ ] 4.4 Update type annotations throughout `getSbx()` and usages to use SDK-native types — use `InstanceType<typeof VercelSandbox>` or equivalent; avoid `as unknown as` casts
- [ ] 4.5 Delete the `VercelSandboxSDKType` interface
- [ ] 4.6 Delete the `VercelSandboxInstance` interface
- [ ] 4.7 Delete the `CommandResult` interface (if covered by SDK types)
- [ ] 4.8 Run `pnpm typecheck` in `packages/sandbox-vercel` — fix any type errors

## 5. Fix Test Dynamic Imports

- [ ] 5.1 In `packages/core/src/cache.test.ts`: add top-level static imports for `middleTruncate` from `./utils.js` and `composeStops` from `./agent.js`
- [ ] 5.2 Remove the inline `await import()` calls from the test bodies and use the statically imported names instead

## 6. Verify

- [ ] 6.1 Run `pnpm build` in `packages/sandbox-e2b` and confirm the build succeeds
- [ ] 6.2 Run `pnpm build` in `packages/sandbox-vercel` and confirm the build succeeds
- [ ] 6.3 Run `pnpm test` across the workspace and confirm all tests pass
