## ADDED Requirements

### Requirement: Sandbox interface defines command execution
The `Sandbox` interface SHALL expose an `exec(command, options?)` method that executes a shell command and returns an `ExecResult` containing `stdout`, `stderr`, and `exitCode`.

#### Scenario: Execute a simple command
- **WHEN** `sandbox.exec("echo hello")` is called
- **THEN** the result SHALL contain `stdout: "hello\n"`, `stderr: ""`, and `exitCode: 0`

#### Scenario: Command fails with non-zero exit code
- **WHEN** `sandbox.exec("exit 1")` is called
- **THEN** the result SHALL contain `exitCode: 1` and SHALL NOT throw an exception

#### Scenario: Command exceeds timeout
- **WHEN** `sandbox.exec("sleep 60", { timeout: 1000 })` is called
- **THEN** the execution SHALL be terminated and the result SHALL indicate a timeout error

### Requirement: Sandbox interface defines filesystem operations
The `Sandbox` interface SHALL expose methods for reading files (`readFile`), writing files (`writeFile`), listing directories (`readDir`), checking file existence (`fileExists`), and checking if a path is a directory (`isDirectory`).

#### Scenario: Read an existing file
- **WHEN** `sandbox.readFile("/tmp/test.txt")` is called and the file exists
- **THEN** the file contents SHALL be returned as a string

#### Scenario: Read a non-existent file
- **WHEN** `sandbox.readFile("/tmp/nonexistent.txt")` is called
- **THEN** the method SHALL throw an error indicating the file does not exist

#### Scenario: Write a file
- **WHEN** `sandbox.writeFile("/tmp/out.txt", "content")` is called
- **THEN** the file SHALL be created (or overwritten) with the given content

#### Scenario: List directory contents
- **WHEN** `sandbox.readDir("/tmp")` is called
- **THEN** the method SHALL return an array of directory entries with name and type information

### Requirement: Sandbox interface defines lifecycle management
The `Sandbox` interface SHALL expose a `destroy()` method for cleaning up resources.

#### Scenario: Destroy a sandbox
- **WHEN** `sandbox.destroy()` is called
- **THEN** all sandbox resources SHALL be released and subsequent operations SHALL fail gracefully

### Requirement: Sandbox interface is provider-agnostic
The `Sandbox` interface SHALL be defined in the `@open-agent-sdk/core` package with no dependencies on any specific sandbox implementation.

#### Scenario: Import sandbox interface without implementation dependency
- **WHEN** a consumer imports `Sandbox` from `@open-agent-sdk/core`
- **THEN** no sandbox implementation packages (e2b, daytona, etc.) SHALL be required as dependencies
