## Context

The three sandbox packages (`sandbox-local`, `sandbox-e2b`, `sandbox-vercel`) each export a `create*Sandbox` factory function that returns a plain object implementing the `Sandbox` interface. State (working directory, lazy-init instance, sandbox ID, etc.) is captured in closures. The pattern works but has downsides: state is invisible from the outside, private helpers float as inner functions, and there is no natural place to share logic between related methods.

TypeScript classes are the idiomatic alternative: state becomes instance fields, private helpers become `private` methods, and the `implements Sandbox` clause makes the contract explicit at the declaration site.

## Goals / Non-Goals

**Goals:**
- Rewrite each sandbox as a class that `implements Sandbox`
- Remove factory functions; classes are the sole public API
- Private helpers (`resolvePath`, `getSbx`, `getE2B`, `ensureRipgrep`) become `private` methods

**Non-Goals:**
- Sharing a common base class across the three sandboxes (their init patterns are different enough that inheritance would complicate rather than simplify)
- Changing any runtime behaviour
- Moving or merging packages

## Decisions

### Classes vs. factory functions
**Decision**: Use classes; remove factory functions entirely.

Alternatives considered:
- **Keep factories** — no change needed, but misses the opportunity for cleaner code organisation.
- **Shared base class** — tempting, but `LocalSandbox` is synchronous while `E2BSandbox`/`VercelSandbox` are async-lazy; a common base would require awkward `abstract` scaffolding.
- **Keep thin factory wrappers** — unnecessary indirection on a greenfield project; `new LocalSandbox(config)` is perfectly readable.

### Async constructors
E2B and Vercel sandboxes use lazy initialisation (sandbox not provisioned until first call). TypeScript constructors cannot be `async`, so the lazy-init promise (`initPromise`) remains a private field, and the private `getSbx()` / `getE2B()` method is the async entry point for all operations — identical to the current closure approach, just as a `private` method.

`new VercelSandbox(config)` and `new E2BSandbox(config)` are synchronous; no `await` needed at the call site.

### Call site migration
All existing callers of the factory functions (`examples/`, test files) must be updated to use `new LocalSandbox(config)` / `new E2BSandbox(config)` / `new VercelSandbox(config)`. The `await` can be dropped where it was only needed for the old async factories.

## Risks / Trade-offs

- **`this` binding in callbacks** — event handlers (`proc.on('close', ...)`) that reference `this` must use arrow functions or be bound. Current closure approach avoids this; class approach requires care. → Mitigation: use arrow function class fields or arrow function callbacks exclusively.
- **`rgPath` getter/setter on `VercelSandbox`** — currently exposed on the returned object. Move to the class as a `get`/`set` pair.
