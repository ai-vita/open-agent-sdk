# memory-sandbox Specification

## Purpose

Provide an in-memory sandbox implementation for testing tools without filesystem side effects, enabling fast and deterministic test execution.

## Requirements
### Requirement: MemorySandbox implements Sandbox interface
The `MemorySandbox` class SHALL implement the full `Sandbox` interface using an in-memory filesystem and a simulated shell executor, with no real filesystem or process side effects.

#### Scenario: Construct with initial files
- **WHEN** a `MemorySandbox` is created with `initialFiles: { "/workspace/hello.txt": "world" }`
- **THEN** calling `readFile("/workspace/hello.txt")` SHALL return `"world"`

#### Scenario: Construct with empty state
- **WHEN** a `MemorySandbox` is created with no arguments
- **THEN** the in-memory filesystem SHALL be empty and `readDir("/")` SHALL return an empty array

### Requirement: In-memory file operations
The `MemorySandbox` SHALL support `readFile`, `writeFile`, `readDir`, `fileExists`, and `isDirectory` operations against its in-memory store.

#### Scenario: Write then read a file
- **WHEN** `writeFile("/workspace/foo.ts", "const x = 1;")` is called
- **THEN** `readFile("/workspace/foo.ts")` SHALL return `"const x = 1;"`
- **AND** `fileExists("/workspace/foo.ts")` SHALL return `true`

#### Scenario: Write creates parent directories
- **WHEN** `writeFile("/workspace/a/b/c.txt", "deep")` is called
- **THEN** `isDirectory("/workspace/a/b")` SHALL return `true`
- **AND** `isDirectory("/workspace/a")` SHALL return `true`

#### Scenario: Read non-existent file throws
- **WHEN** `readFile("/workspace/missing.txt")` is called
- **THEN** the operation SHALL throw an error indicating the file does not exist

#### Scenario: List directory contents
- **WHEN** files exist at `/workspace/a.ts` and `/workspace/sub/b.ts`
- **THEN** `readDir("/workspace")` SHALL return entries for `a.ts` (not directory) and `sub` (directory)

### Requirement: Shell command simulation
The `MemorySandbox` SHALL provide an `exec` method. It MAY return a stub result for commands it does not simulate, with exit code 1 and a descriptive stderr message.

#### Scenario: Echo command
- **WHEN** `exec('echo "hello"')` is called
- **THEN** the result SHALL have `stdout` containing `"hello"` and `exitCode` of `0`

#### Scenario: Unsupported command
- **WHEN** `exec('curl http://example.com')` is called
- **THEN** the result SHALL have `exitCode` of `1` and `stderr` indicating the command is not supported in the memory sandbox

### Requirement: Destroy is a no-op
The `MemorySandbox` SHALL implement `destroy()` as a resolved promise with no side effects.

#### Scenario: Destroy completes
- **WHEN** `destroy()` is called
- **THEN** the promise SHALL resolve without error

### Requirement: Package structure
The `MemorySandbox` SHALL be exported from `@open-agent-sdk/sandbox-memory` as the default class export.

#### Scenario: Import path
- **WHEN** a consumer imports `{ MemorySandbox } from "@open-agent-sdk/sandbox-memory"`
- **THEN** the import SHALL resolve to the `MemorySandbox` class

