## ADDED Requirements

### Requirement: resolveWorkspacePath normalizes and validates paths
The `resolveWorkspacePath(rootDir, requestedPath)` function SHALL return an absolute, normalized path that is guaranteed to be within `rootDir`. It SHALL throw if the resolved path escapes the root.

#### Scenario: Absolute path within root
- **WHEN** `resolveWorkspacePath("/workspace", "/workspace/src/index.ts")` is called
- **THEN** it SHALL return `"/workspace/src/index.ts"`

#### Scenario: Relative path resolved against root
- **WHEN** `resolveWorkspacePath("/workspace", "src/index.ts")` is called
- **THEN** it SHALL return `"/workspace/src/index.ts"`

#### Scenario: Path with dot-dot components within root
- **WHEN** `resolveWorkspacePath("/workspace", "/workspace/src/../lib/util.ts")` is called
- **THEN** it SHALL return `"/workspace/lib/util.ts"`

#### Scenario: Path escaping root via dot-dot
- **WHEN** `resolveWorkspacePath("/workspace", "/workspace/../../etc/passwd")` is called
- **THEN** it SHALL throw an error indicating the path is outside the workspace

#### Scenario: Relative path escaping root
- **WHEN** `resolveWorkspacePath("/workspace", "../../etc/passwd")` is called
- **THEN** it SHALL throw an error indicating the path is outside the workspace

#### Scenario: Empty path returns root
- **WHEN** `resolveWorkspacePath("/workspace", "")` is called
- **THEN** it SHALL return `"/workspace"`

### Requirement: Path normalization handles edge cases
The resolver SHALL handle trailing slashes, double slashes, and dot components.

#### Scenario: Trailing slash stripped
- **WHEN** `resolveWorkspacePath("/workspace", "/workspace/src/")` is called
- **THEN** it SHALL return `"/workspace/src"`

#### Scenario: Double slashes normalized
- **WHEN** `resolveWorkspacePath("/workspace", "/workspace//src//index.ts")` is called
- **THEN** it SHALL return `"/workspace/src/index.ts"`

#### Scenario: Single dot component
- **WHEN** `resolveWorkspacePath("/workspace", "/workspace/./src/./index.ts")` is called
- **THEN** it SHALL return `"/workspace/src/index.ts"`

### Requirement: Exported from core package
The `resolveWorkspacePath` function SHALL be exported from `@open-agent-sdk/core`.

#### Scenario: Import path
- **WHEN** a consumer imports `{ resolveWorkspacePath } from "@open-agent-sdk/core"`
- **THEN** the import SHALL resolve to the function
