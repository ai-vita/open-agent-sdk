import { existsSync, mkdirSync } from "node:fs";
import {
  readFile,
  writeFile,
  readdir,
  stat,
  mkdir,
  access,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import type { Sandbox, ExecOptions, ExecResult, DirEntry } from "@open-agent-sdk/core";

export interface LocalSandboxConfig {
  /** Working directory for relative paths (default: /tmp) */
  cwd?: string;
}

/**
 * Local sandbox that executes commands and accesses the filesystem
 * using Node.js built-in APIs. Supports Bun and Node.js runtimes.
 */
export class LocalSandbox implements Sandbox {
  private workingDirectory: string;

  constructor(config: LocalSandboxConfig = {}) {
    this.workingDirectory = config.cwd ?? "/tmp";

    // Ensure working directory exists
    if (!existsSync(this.workingDirectory)) {
      mkdirSync(this.workingDirectory, { recursive: true });
    }
  }

  private resolvePath(p: string): string {
    return p.startsWith("/") ? p : `${this.workingDirectory}/${p}`;
  }

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    const startTime = performance.now();
    let interrupted = false;

    const cwd = options?.cwd ?? this.workingDirectory;

    // Ensure cwd exists
    if (!existsSync(cwd)) {
      mkdirSync(cwd, { recursive: true });
    }

    return new Promise<ExecResult>((resolve) => {
      const proc = spawn("sh", ["-c", command], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });
      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          interrupted = true;
          proc.kill("SIGKILL");
        }, options.timeout);
      }

      proc.on("close", (exitCode: number | null) => {
        if (timeoutId) clearTimeout(timeoutId);
        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          stdout,
          stderr,
          exitCode: exitCode ?? (interrupted ? 137 : 1),
          durationMs,
          interrupted,
        });
      });

      proc.on("error", (err: Error) => {
        if (timeoutId) clearTimeout(timeoutId);
        const durationMs = Math.round(performance.now() - startTime);
        resolve({
          stdout: "",
          stderr: err.message,
          exitCode: 1,
          durationMs,
          interrupted: false,
        });
      });
    });
  }

  async readFile(path: string): Promise<string> {
    const fullPath = this.resolvePath(path);
    return readFile(fullPath, "utf-8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(path);
    // Create parent directories
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const fullPath = this.resolvePath(path);
    const entries = await readdir(fullPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
    }));
  }

  async fileExists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path);
    try {
      const s = await stat(fullPath);
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    // No cleanup needed for local sandbox
  }

  // Local sandbox has no remote id
  readonly id = undefined;
}
