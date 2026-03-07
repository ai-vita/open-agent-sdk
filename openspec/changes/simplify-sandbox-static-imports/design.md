## Context

Three areas of unnecessary dynamic imports:

**`packages/sandbox-e2b/src/index.ts`** — wraps `@e2b/code-interpreter`. Uses `await import()` to load the SDK on first use, surrounded by a try/catch emitting a custom install message. `@e2b/code-interpreter` is declared as a required peer dep. Internal interfaces `E2BSandboxSDKType` and `E2BSandboxInstance` hand-replicate the SDK's types.

**`packages/sandbox-vercel/src/index.ts`** — wraps `@vercel/sandbox`. Same pattern. The cast is even more severe: `module.Sandbox as unknown as VercelSandboxSDKType` — the `unknown` intermediate cast indicates the internal interface has diverged enough from the real type that a direct cast was rejected by TypeScript. `@vercel/sandbox` is declared as a required peer dep. Internal interfaces `VercelSandboxSDKType`, `CommandResult`, and `VercelSandboxInstance` hand-replicate the SDK's types.

**`packages/core/src/cache.test.ts`** — uses `await import("./utils.js")` and `await import("./agent.js")` in test cases for `middleTruncate` and `composeStops`. These are plain, stateless functions with no isolation requirement — the dynamic imports serve no purpose.

**`packages/tools/src/web-fetch.ts` and `web-search.ts`** — use `await import("parallel-web")`, which is declared `optional: true`. This is the correct pattern for a genuinely optional dependency and is out of scope.

## Goals / Non-Goals

**Goals:**
- Move `@e2b/code-interpreter` and `@vercel/sandbox` from `peerDependencies` to `dependencies` in their respective packages
- Replace dynamic imports with top-level static imports in both sandbox packages
- Use SDK-exported types directly, eliminating hand-maintained internal interfaces and type assertions
- Replace `await import()` calls in `cache.test.ts` with top-level static imports
- Preserve the lazy sandbox *provisioning* pattern (the promise singleton that defers actual sandbox creation until first use)
- Keep the public API (`createE2BSandbox`, `createVercelSandbox`, `E2BSandboxConfig`, `VercelSandboxConfig`, and all `Sandbox` methods) unchanged

**Non-Goals:**
- Changing any runtime behavior of either sandbox
- Modifying the `Sandbox` interface from `@open-agent-sdk/core`
- Touching `parallel-web` dynamic imports in `@open-agent-sdk/tools`
- Restructuring the lazy provisioning pattern itself
- Moving web tools to a separate package (tracked as a separate change)

## Decisions

### Decision 1: Regular dependencies, not peer dependencies

**Choice:** Move `@e2b/code-interpreter` to `dependencies` in sandbox-e2b, and `@vercel/sandbox` to `dependencies` in sandbox-vercel.

**Rationale:** Peer dependencies are appropriate when: (a) the dep must be a singleton across the entire app (e.g., React, to avoid hook context mismatches), or (b) the consumer already has the dep installed and duplication would cause conflicts. Neither applies here. `sandbox-e2b` is a dedicated adapter — there is no use case for installing it without `@e2b/code-interpreter`. Making it a regular dep means consumers install one package and get everything they need, with no peer dep warnings and no separate install step. The custom "Install with: npm install ..." error message in the try/catch is also rendered obsolete — it was working around the friction of a peer dep setup.

**Alternatives considered:**
- *Keep as peer dep:* Gives consumers version control, but adds install friction and is semantically incorrect for a dedicated adapter.
- *Make optional peer dep:* Nonsensical — the package cannot function without the SDK.

### Decision 2: Static top-level import for both packages

**Choice:** `import { Sandbox as E2BSandbox } from "@e2b/code-interpreter"` and `import { Sandbox as VercelSandbox } from "@vercel/sandbox"` at module top level.

**Rationale:** With the SDKs now as regular dependencies, static imports are unambiguously correct. They give TypeScript full type information at compile time without assertions, are analyzed by bundlers for tree-shaking, and are the universal standard. The dynamic import pattern was solving a problem (optional/uncertain availability) that does not exist for required dependencies.

**Alternatives considered:**
- *Keep dynamic import with regular dep:* Still requires internal interface types and type assertions. Adds complexity with zero benefit.

### Decision 3: Use SDK types directly

**Choice:** Import and use types exported by each SDK directly, removing all hand-written internal interface types.

**Rationale:** The internal interfaces were workarounds forced by the dynamic import pattern. With static imports, TypeScript infers types from the SDKs directly. The `as unknown as VercelSandboxSDKType` cast in sandbox-vercel is a clear symptom of type drift — SDK-native types eliminate this completely and will stay accurate as SDKs evolve.

**Note for sandbox-vercel:** Inspect the actual `@vercel/sandbox` exports. If it exports a class, use `InstanceType<typeof VercelSandbox>` for instance types. If type gaps remain (SDK types are too broad), prefer targeted narrowing utilities (`Pick`, `Parameters`, etc.) over opaque hand-written interfaces.

### Decision 4: Preserve lazy provisioning

**Choice:** Keep `getE2B()` and `getSbx()` singleton patterns that defer sandbox *creation* (network call) until first use.

**Rationale:** Lazy provisioning is sound for cloud resources — it avoids paying for startup if the sandbox is never used, and the promise singleton prevents concurrent first-calls from racing to create multiple sandboxes. This is orthogonal to module loading and should not change.

### Decision 5: Static imports in cache.test.ts

**Choice:** Replace `await import("./utils.js")` and `await import("./agent.js")` with top-level static imports.

**Rationale:** `middleTruncate` and `composeStops` are pure, stateless functions. No mock setup occurs before the dynamic imports, no module registry manipulation, no isolation pattern. The dynamic imports are simply unnecessary and make the test file inconsistent with the rest of the test suite.

## Risks / Trade-offs

- [Vercel SDK type complexity] `@vercel/sandbox` may export types in a non-standard shape. → Inspect actual exports before writing type annotations. Prefer SDK utilities over casting.
- [Bundle size for consumers] Regular deps are always installed; previously consumers could theoretically skip installing the SDK (though the package wouldn't work). → Irrelevant for dedicated adapters; this is the expected behavior.
