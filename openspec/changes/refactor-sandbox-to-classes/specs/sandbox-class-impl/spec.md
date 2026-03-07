## ADDED Requirements

### Requirement: Each sandbox package exports a class that implements Sandbox
Each sandbox package (`sandbox-local`, `sandbox-e2b`, `sandbox-vercel`) SHALL export a named class (`LocalSandbox`, `E2BSandbox`, `VercelSandboxImpl` or `VercelSandbox`) that explicitly implements the `Sandbox` interface from `@open-agent-sdk/core`.

#### Scenario: Class satisfies Sandbox interface
- **WHEN** `LocalSandbox` / `E2BSandbox` / `VercelSandbox` is instantiated
- **THEN** the instance satisfies the `Sandbox` interface and can be used anywhere a `Sandbox` is expected

#### Scenario: Class is exported from the package
- **WHEN** a consumer imports from the sandbox package
- **THEN** the class is the primary named export (no factory function)

### Requirement: Path resolution is a private method
Each class SHALL have a `private resolvePath(p: string): string` method that returns the absolute path, prefixing the working directory for relative paths.

#### Scenario: Relative path resolved
- **WHEN** `resolvePath("foo.txt")` is called
- **THEN** it returns `<workingDirectory>/foo.txt`

#### Scenario: Absolute path unchanged
- **WHEN** `resolvePath("/abs/foo.txt")` is called
- **THEN** it returns `/abs/foo.txt`

### Requirement: Lazy initialisation is a private async method
For `E2BSandbox` and `VercelSandbox`, sandbox provisioning SHALL occur in a `private` async method (`getE2B()` / `getSbx()`) called by each public operation method, with a promise-deduplication guard to prevent concurrent provisioning.

#### Scenario: Single sandbox provisioned on concurrent first calls
- **WHEN** two operations are called concurrently before the sandbox is initialised
- **THEN** only one sandbox instance is provisioned (the in-flight `initPromise` is reused)

#### Scenario: Subsequent calls reuse existing instance
- **WHEN** the sandbox has already been provisioned
- **THEN** `getE2B()` / `getSbx()` returns the cached instance without re-provisioning
