## Why

The three sandbox implementations (`sandbox-local`, `sandbox-e2b`, `sandbox-vercel`) use factory functions that return plain object literals. This pattern scatters state management across closures and makes the code harder to navigate, extend, and test. Classes provide a natural home for shared logic (path resolution, lazy init), clearer encapsulation, and better readability.

## What Changes

- Replace `createLocalSandbox()` factory function with a `LocalSandbox` class in `packages/sandbox-local`
- Replace `createE2BSandbox()` factory function with an `E2BSandbox` class in `packages/sandbox-e2b`
- Replace `createVercelSandbox()` factory function with a `VercelSandbox` class in `packages/sandbox-vercel`
- Each class implements the `Sandbox` interface from `@open-agent-sdk/core`
- Factory functions are removed; callers use `new LocalSandbox(config)` etc. directly
- Shared path-resolution logic (`resolvePath`) moves into each class as a private method

## Capabilities

### New Capabilities

- `sandbox-class-impl`: Sandbox implementations as classes with a shared `resolvePath` private method, constructor-based config, and lazy initialization via `getSbx()`/`getE2B()` as private methods

### Modified Capabilities

<!-- No existing spec-level behavior changes — this is a pure internal refactor -->

## Impact

- **Files changed**: `packages/sandbox-local/src/index.ts`, `packages/sandbox-e2b/src/index.ts`, `packages/sandbox-vercel/src/index.ts`
- **Public API**: Factory functions removed; classes (`LocalSandbox`, `E2BSandbox`, `VercelSandbox`) are the sole exports
- **Dependencies**: None added
- **Tests**: Existing tests continue to pass; class internals can now be tested more directly
