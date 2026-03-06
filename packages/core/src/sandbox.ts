/**
 * Options for executing a shell command.
 */
export interface ExecOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Working directory override */
  cwd?: string;
}

/**
 * Result of executing a shell command.
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  interrupted: boolean;
}

/**
 * A directory entry returned by readDir.
 */
export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

/**
 * The Sandbox interface defines the minimal contract for all sandbox
 * implementations. Tools receive a Sandbox and use it for both command
 * execution and filesystem operations.
 */
export interface Sandbox {
  /** Execute a shell command and return the result. Never throws on non-zero exit. */
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;

  /** Read a file's contents as a string. Throws if not found. */
  readFile(path: string): Promise<string>;

  /** Write content to a file, creating parent directories as needed. */
  writeFile(path: string, content: string): Promise<void>;

  /** List directory contents. */
  readDir(path: string): Promise<DirEntry[]>;

  /** Check whether a path exists. */
  fileExists(path: string): Promise<boolean>;

  /** Check whether a path is a directory. */
  isDirectory(path: string): Promise<boolean>;

  /** Release all sandbox resources. */
  destroy(): Promise<void>;

  /**
   * Sandbox ID for reconnection (cloud providers only).
   * Undefined for local sandboxes.
   */
  readonly id?: string;

  /**
   * Path to ripgrep binary.
   * Set by the sandbox implementation or ensureSandboxTools().
   */
  rgPath?: string;
}
