## ADDED Requirements

### Requirement: Vercel sandbox executes commands in Firecracker microVMs
The `@open-agent-sdk/sandbox-vercel` package SHALL provide a `createVercelSandbox(options?)` factory that returns a `Sandbox` implementation backed by Vercel's Firecracker microVM infrastructure via `@vercel/sandbox`.

#### Scenario: Execute a command in Vercel sandbox
- **WHEN** `sandbox.exec("node --version")` is called
- **THEN** the command SHALL be executed in an isolated Firecracker microVM and return the output

#### Scenario: Configure runtime and resources
- **WHEN** `createVercelSandbox({ runtime: "node22", resources: { vcpus: 2 } })` is called
- **THEN** the sandbox SHALL use the specified runtime and resource configuration

### Requirement: Vercel sandbox implements full Sandbox interface
The Vercel sandbox SHALL implement all methods of the `Sandbox` interface, translating operations to Vercel sandbox API calls.

#### Scenario: Read a file from the microVM
- **WHEN** `sandbox.readFile("/home/user/app.ts")` is called
- **THEN** the file contents SHALL be fetched from the Vercel sandbox environment

### Requirement: Vercel sandbox supports reconnection
The Vercel sandbox SHALL expose a `sandbox.id` property and support reconnecting to an existing sandbox via `sandboxId` option.

#### Scenario: Reconnect to existing sandbox
- **WHEN** `createVercelSandbox({ sandboxId: "existing-id" })` is called
- **THEN** the sandbox SHALL reconnect to the existing Firecracker microVM instead of creating a new one

### Requirement: Vercel sandbox auto-provisions tools
The Vercel sandbox SHALL automatically install ripgrep in the microVM on creation (configurable via `ensureTools` option) so the Grep tool can use it.

#### Scenario: Auto-install ripgrep
- **WHEN** `createVercelSandbox()` is called with default options
- **THEN** ripgrep SHALL be installed and `sandbox.rgPath` SHALL be set

#### Scenario: Skip tool provisioning
- **WHEN** `createVercelSandbox({ ensureTools: false })` is called
- **THEN** ripgrep SHALL NOT be installed (faster startup)
