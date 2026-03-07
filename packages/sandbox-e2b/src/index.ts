import { Sandbox as E2BCodeInterpreter } from "@e2b/code-interpreter";
import type { Sandbox, ExecOptions, ExecResult, DirEntry } from "@open-agent-sdk/core";

export interface E2BSandboxConfig {
  apiKey?: string;
  /** Reconnect to an existing sandbox by ID instead of creating a new one */
  sandboxId?: string;
  template?: string;
  /** Sandbox timeout in milliseconds (default: 300000 / 5 minutes) */
  timeout?: number;
  /** Working directory in the sandbox (default: /home/user) */
  cwd?: string;
  metadata?: Record<string, string>;
}

/**
 * E2B cloud sandbox implementing the Sandbox interface.
 * Uses lazy initialization — the sandbox is not provisioned until the first operation.
 * Supports reconnection via sandboxId.
 */
export class E2BSandbox implements Sandbox {
  private workingDirectory: string;
  private timeout: number;
  private sandboxId: string | undefined;
  private e2bInstance: InstanceType<typeof E2BCodeInterpreter> | null = null;
  private initPromise: Promise<InstanceType<typeof E2BCodeInterpreter>> | null = null;

  constructor(private config: E2BSandboxConfig = {}) {
    this.workingDirectory = config.cwd ?? "/home/user";
    this.timeout = config.timeout ?? 300000;
    this.sandboxId = config.sandboxId;
  }

  private async getE2B(): Promise<InstanceType<typeof E2BCodeInterpreter>> {
    if (this.e2bInstance) return this.e2bInstance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      let sbx: InstanceType<typeof E2BCodeInterpreter>;
      if (this.config.sandboxId) {
        sbx = await E2BCodeInterpreter.connect(this.config.sandboxId);
      } else {
        sbx = await E2BCodeInterpreter.create({
          apiKey: this.config.apiKey,
          timeoutMs: this.timeout,
          metadata: this.config.metadata,
        });
        this.sandboxId = sbx.sandboxId;
      }

      this.e2bInstance = sbx;
      return sbx;
    })();

    return this.initPromise;
  }

  private resolvePath(path: string): string {
    return path.startsWith("/") ? path : `${this.workingDirectory}/${path}`;
  }

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    const sbx = await this.getE2B();
    const startTime = performance.now();

    try {
      const result = await sbx.commands.run(command, {
        cwd: options?.cwd ?? this.workingDirectory,
        timeoutMs: options?.timeout,
      });

      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.exitCode ?? 0,
        durationMs: Math.round(performance.now() - startTime),
        interrupted: false,
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
        return { stdout: "", stderr: "Command timed out", exitCode: 124, durationMs, interrupted: true };
      }

      const exitMatch = error instanceof Error ? error.message.match(/exit status (\d+)/i) : null;
      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: exitMatch ? parseInt(exitMatch[1], 10) : 1,
        durationMs,
        interrupted: false,
      };
    }
  }

  async readFile(path: string): Promise<string> {
    const sbx = await this.getE2B();
    const fullPath = this.resolvePath(path);
    return sbx.files.read(fullPath) as Promise<string>;
  }

  async writeFile(path: string, content: string): Promise<void> {
    const sbx = await this.getE2B();
    const fullPath = this.resolvePath(path);
    await sbx.files.write(fullPath, content);
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const sbx = await this.getE2B();
    const fullPath = this.resolvePath(path);
    const entries = await sbx.files.list(fullPath) as Array<{ name: string; type?: string; isDir?: boolean }>;
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.type === "dir" || e.isDir === true,
    }));
  }

  async fileExists(path: string): Promise<boolean> {
    const sbx = await this.getE2B();
    const fullPath = this.resolvePath(path);
    try {
      await sbx.files.read(fullPath);
      return true;
    } catch {
      try {
        await sbx.files.list(fullPath);
        return true;
      } catch {
        return false;
      }
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    const sbx = await this.getE2B();
    const fullPath = this.resolvePath(path);
    try {
      await sbx.files.list(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async destroy(): Promise<void> {
    if (this.e2bInstance) {
      await this.e2bInstance.kill();
      this.e2bInstance = null;
    }
  }

  get id() {
    return this.sandboxId;
  }
}
