# sandbox-local Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Local sandbox executes commands via native process spawning
The `@open-agent-sdk/sandbox-local` package SHALL provide a `createLocalSandbox(options?)` factory that returns a `Sandbox` implementation executing commands on the local machine.

#### Scenario: Execute a bash command locally
- **WHEN** `sandbox.exec("ls -la")` is called on a local sandbox
- **THEN** the command SHALL be executed using the system's shell and return the actual filesystem output

#### Scenario: Configure working directory
- **WHEN** `createLocalSandbox({ cwd: "/home/user/project" })` is called
- **THEN** all commands and filesystem operations SHALL be relative to the specified directory

### Requirement: Local sandbox provides filesystem operations
The local sandbox SHALL implement all `Sandbox` filesystem methods using native filesystem APIs.

#### Scenario: Read a local file
- **WHEN** `sandbox.readFile("./src/index.ts")` is called
- **THEN** the actual file contents from the local filesystem SHALL be returned

#### Scenario: Write a local file
- **WHEN** `sandbox.writeFile("./output.txt", "data")` is called
- **THEN** the file SHALL be written to the local filesystem at the resolved path

### Requirement: Local sandbox supports command timeout
The local sandbox SHALL terminate commands that exceed the configured timeout.

#### Scenario: Command exceeds timeout
- **WHEN** a command runs longer than the configured timeout
- **THEN** the process SHALL be killed and the result SHALL indicate a timeout

