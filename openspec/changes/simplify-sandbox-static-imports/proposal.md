## Why

Two sandbox packages — `@open-agent-sdk/sandbox-e2b` and `@open-agent-sdk/sandbox-vercel` — use `await import()` guarded by a try/catch to load their respective SDKs, even though both SDKs are required dependencies that must always be present. This adds unnecessary complexity: hand-maintained internal interface types that can drift from the SDK's own types, type assertions (`as unknown as ...`) caused by the loss of type information through dynamic imports, and a try/catch wrapping a module load that cannot legitimately fail. Additionally, both SDKs are declared as peer dependencies when they should be regular dependencies — these packages are dedicated adapters with no use case that doesn't include the SDK.

A secondary cleanup: `packages/core/src/cache.test.ts` uses `await import()` for internal modules (`utils.js`, `agent.js`) with no isolation or mocking rationale — plain static imports are correct there.

Note: `parallel-web` in `@open-agent-sdk/tools` is a genuinely optional peer dep and its dynamic import pattern is correct — this change does not touch it. Extracting web tools into a separate package is a distinct architectural change tracked separately.

## What Changes

- Move `@e2b/code-interpreter` from `peerDependencies` to `dependencies` in `packages/sandbox-e2b/package.json`
- Move `@vercel/sandbox` from `peerDependencies` to `dependencies` in `packages/sandbox-vercel/package.json`
- Replace `await import("@e2b/code-interpreter")` with a top-level static import in `packages/sandbox-e2b/src/index.ts`
- Replace `await import("@vercel/sandbox")` with a top-level static import in `packages/sandbox-vercel/src/index.ts`
- Remove `E2BSandboxSDKType` and `E2BSandboxInstance` internal interfaces in sandbox-e2b (replaced by SDK types)
- Remove `VercelSandboxSDKType`, `VercelSandboxInstance`, and `CommandResult` internal interfaces in sandbox-vercel (replaced by SDK types)
- Simplify `getE2B()` and `getSbx()` — remove the try/catch wrapping the module import
- Replace `await import()` calls in `packages/core/src/cache.test.ts` with top-level static imports
- The lazy sandbox *provisioning* pattern (deferred until first use) is preserved in both packages; only deferred *module loading* is eliminated

## Capabilities

### New Capabilities

None — this is a pure implementation simplification with no behavior changes.

### Modified Capabilities

None — the public `Sandbox` interface and all its methods remain unchanged.

## Impact

- `packages/sandbox-e2b/package.json` — `@e2b/code-interpreter` moves to `dependencies`
- `packages/sandbox-e2b/src/index.ts` — simplified implementation
- `packages/sandbox-vercel/package.json` — `@vercel/sandbox` moves to `dependencies`
- `packages/sandbox-vercel/src/index.ts` — simplified implementation
- `packages/core/src/cache.test.ts` — static imports replace unnecessary dynamic imports
- Consumers no longer need to separately install the E2B or Vercel SDKs
- TypeScript consumers benefit from proper SDK type inference instead of cast-to-any interfaces
