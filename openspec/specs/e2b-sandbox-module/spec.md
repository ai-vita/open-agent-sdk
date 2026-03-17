# e2b-sandbox-module Specification

## Purpose

Declare the E2B SDK as a regular dependency and use static imports instead of dynamic await import(), eliminating unnecessary complexity and improving type safety.

## Requirements
### Requirement: E2B SDK as regular dependency
`@open-agent-sdk/sandbox-e2b` SHALL declare `@e2b/code-interpreter` as a regular `dependency`, not a peer dependency.

#### Scenario: Consumer installs sandbox-e2b
- **WHEN** a consumer runs `npm install @open-agent-sdk/sandbox-e2b`
- **THEN** `@e2b/code-interpreter` is automatically installed as a transitive dependency without a separate install step

### Requirement: E2B module loaded via static import
The `@open-agent-sdk/sandbox-e2b` package SHALL import `@e2b/code-interpreter` using a top-level static ES module import statement rather than a dynamic `await import()` call.

#### Scenario: Module resolved at load time
- **WHEN** the `sandbox-e2b` module is loaded
- **THEN** `@e2b/code-interpreter` is resolved synchronously at module load time without a try/catch or deferred import

#### Scenario: Module missing
- **WHEN** `@e2b/code-interpreter` is not installed (e.g., corrupted install)
- **THEN** Node.js throws a standard "Cannot find module" error at package load time

### Requirement: E2B sandbox types from SDK
The implementation SHALL use the types exported by `@e2b/code-interpreter` directly, without hand-maintained internal interface duplicates (`E2BSandboxSDKType`, `E2BSandboxInstance`).

#### Scenario: Type-safe sandbox access
- **WHEN** the implementation calls methods on the E2B sandbox instance
- **THEN** TypeScript resolves all types from the SDK's own declarations without type assertions

### Requirement: Vercel SDK as regular dependency
`@open-agent-sdk/sandbox-vercel` SHALL declare `@vercel/sandbox` as a regular `dependency`, not a peer dependency.

#### Scenario: Consumer installs sandbox-vercel
- **WHEN** a consumer runs `npm install @open-agent-sdk/sandbox-vercel`
- **THEN** `@vercel/sandbox` is automatically installed as a transitive dependency without a separate install step

### Requirement: Vercel module loaded via static import
The `@open-agent-sdk/sandbox-vercel` package SHALL import `@vercel/sandbox` using a top-level static ES module import statement rather than a dynamic `await import()` call.

#### Scenario: Module resolved at load time
- **WHEN** the `sandbox-vercel` module is loaded
- **THEN** `@vercel/sandbox` is resolved synchronously at module load time without a try/catch or deferred import

#### Scenario: Module missing
- **WHEN** `@vercel/sandbox` is not installed (e.g., corrupted install)
- **THEN** Node.js throws a standard "Cannot find module" error at package load time

### Requirement: Vercel sandbox types from SDK
The implementation SHALL use types exported by `@vercel/sandbox` directly, without hand-maintained internal interfaces (`VercelSandboxSDKType`, `VercelSandboxInstance`, `CommandResult`).

#### Scenario: Type-safe Vercel sandbox access
- **WHEN** the implementation calls methods on the Vercel sandbox instance
- **THEN** TypeScript resolves all types from the SDK's own declarations without `as unknown as` casts

### Requirement: Test files use static imports for internal modules
Test files SHALL use top-level static imports for internal modules when no module isolation, mocking, or lazy-init testing is required.

#### Scenario: Utility function test
- **WHEN** a test imports a plain utility function (e.g., `middleTruncate`, `composeStops`)
- **THEN** the import MUST be a top-level static import, not a dynamic `await import()`

### Requirement: Optional peer dep dynamic imports unchanged
Dynamic `await import()` calls for `parallel-web` in `@open-agent-sdk/tools` SHALL remain unchanged, as `parallel-web` is a genuinely optional peer dependency.

#### Scenario: Optional dep not installed
- **WHEN** `parallel-web` is not installed
- **THEN** the tools package degrades gracefully using the dynamic import try/catch pattern

