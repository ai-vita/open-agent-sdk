import path from "node:path";
import type { DirEntry, ExecOptions, ExecResult, Sandbox } from "@open-agent-sdk/core";

export interface MemorySandboxOptions {
  /** Pre-populate the in-memory filesystem */
  initialFiles?: Record<string, string>;
  /** Working directory (default: "/workspace") */
  cwd?: string;
}

/**
 * In-memory sandbox for testing tools without filesystem side effects.
 * Implements the full Sandbox interface using an in-memory Map.
 */
export class MemorySandbox implements Sandbox {
  private files = new Map<string, string>();
  private directories = new Set<string>();
  private readonly cwd: string;

  constructor(options?: MemorySandboxOptions) {
    this.cwd = options?.cwd ?? "/workspace";
    this.directories.add("/");

    if (options?.initialFiles) {
      for (const [filePath, content] of Object.entries(options.initialFiles)) {
        this.files.set(filePath, content);
        this.ensureParentDirs(filePath);
      }
    }
  }

  async exec(command: string, _options?: ExecOptions): Promise<ExecResult> {
    const start = Date.now();

    // Support echo command
    const echoMatch =
      command.match(/^echo\s+"(.*)"\s*$/) ??
      command.match(/^echo\s+'(.*)'\s*$/) ??
      command.match(/^echo\s+(.*)\s*$/);
    if (echoMatch) {
      return {
        stdout: echoMatch[1],
        stderr: "",
        exitCode: 0,
        durationMs: Date.now() - start,
        interrupted: false,
      };
    }

    return {
      stdout: "",
      stderr: `Command not supported in memory sandbox: ${command}`,
      exitCode: 1,
      durationMs: Date.now() - start,
      interrupted: false,
    };
  }

  async readFile(filePath: string): Promise<string> {
    const resolved = this.resolve(filePath);
    const content = this.files.get(resolved);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file '${resolved}'`);
    }
    return content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolved = this.resolve(filePath);
    this.ensureParentDirs(resolved);
    this.files.set(resolved, content);
  }

  async readDir(dirPath: string): Promise<DirEntry[]> {
    const resolved = this.resolve(dirPath);
    const entries = new Map<string, DirEntry>();

    const prefix = resolved === "/" ? "/" : `${resolved}/`;

    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relative = filePath.slice(prefix.length);
        const name = relative.split("/")[0];
        if (name && !entries.has(name)) {
          entries.set(name, { name, isDirectory: relative.includes("/") });
        }
      }
    }

    for (const dir of this.directories) {
      if (dir.startsWith(prefix) && dir !== resolved) {
        const relative = dir.slice(prefix.length);
        const name = relative.split("/")[0];
        if (name && !entries.has(name)) {
          entries.set(name, { name, isDirectory: true });
        }
      }
    }

    return [...entries.values()];
  }

  async fileExists(filePath: string): Promise<boolean> {
    const resolved = this.resolve(filePath);
    return this.files.has(resolved) || this.directories.has(resolved);
  }

  async isDirectory(dirPath: string): Promise<boolean> {
    const resolved = this.resolve(dirPath);
    return this.directories.has(resolved);
  }

  async destroy(): Promise<void> {
    // No-op for in-memory sandbox
  }

  private resolve(p: string): string {
    return path.isAbsolute(p) ? path.normalize(p) : path.resolve(this.cwd, p);
  }

  private ensureParentDirs(filePath: string): void {
    let dir = path.dirname(filePath);
    while (dir && dir !== "/" && !this.directories.has(dir)) {
      this.directories.add(dir);
      dir = path.dirname(dir);
    }
    if (!this.directories.has("/")) {
      this.directories.add("/");
    }
  }
}
