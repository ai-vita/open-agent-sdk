# sandbox-e2b Specification

## Purpose

Provide a sandbox implementation that executes commands and file operations in E2B cloud sandboxes for isolated, secure execution.

## Requirements
### Requirement: E2B sandbox executes commands in cloud environments
The `@open-agent-sdk/sandbox-e2b` package SHALL provide a `createE2BSandbox(options)` factory that returns a `Sandbox` implementation backed by E2B's code interpreter API.

#### Scenario: Execute a command in E2B
- **WHEN** `sandbox.exec("python3 -c 'print(1+1)'")` is called
- **THEN** the command SHALL be executed in an E2B cloud sandbox and return the output

#### Scenario: Configure E2B template
- **WHEN** `createE2BSandbox({ template: "custom-template" })` is called
- **THEN** the sandbox SHALL use the specified E2B template

### Requirement: E2B sandbox implements full Sandbox interface
The E2B sandbox SHALL implement all methods of the `Sandbox` interface, translating operations to E2B API calls.

#### Scenario: Read a file from E2B sandbox
- **WHEN** `sandbox.readFile("/home/user/file.txt")` is called
- **THEN** the file contents SHALL be fetched from the E2B sandbox environment

### Requirement: E2B sandbox manages lifecycle
The E2B sandbox SHALL create a cloud sandbox on first use and destroy it when `destroy()` is called.

#### Scenario: Lazy initialization
- **WHEN** the first operation is called on the sandbox
- **THEN** the E2B sandbox SHALL be provisioned before executing the operation

#### Scenario: Cleanup on destroy
- **WHEN** `sandbox.destroy()` is called
- **THEN** the E2B cloud sandbox SHALL be terminated to stop billing

