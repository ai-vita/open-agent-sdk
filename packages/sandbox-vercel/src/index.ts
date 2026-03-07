import { Sandbox as VercelSandboxImpl } from "@vercel/sandbox";
import type { Sandbox, ExecOptions, ExecResult, DirEntry } from "@open-agent-sdk/core";

export interface VercelSandboxConfig {
  runtime?: "node22" | "python3.13";
  resources?: { vcpus: number };
  /** Reconnect to an existing sandbox by ID */
  sandboxId?: string;
  /** Sandbox timeout in ms (default: 300000) */
  timeout?: number;
  /** Working directory in sandbox (default: /vercel/sandbox) */
  cwd?: string;
  teamId?: string;
  projectId?: string;
  token?: string;
  /**
   * Install ripgrep in the sandbox for faster grep operations.
   * Default: true
   */
  ensureTools?: boolean;
}

/**
 * Vercel Firecracker sandbox implementing the Sandbox interface.
 * Uses lazy singleton initialization — the sandbox is provisioned on first use.
 * Supports reconnection via sandboxId.
 */
export class VercelSandbox implements Sandbox {
  private workingDirectory: string;
  private timeout: number;
  private sandboxId: string | undefined;
  private sbxInstance: VercelSandboxImpl | null = null;
  private initPromise: Promise<VercelSandboxImpl> | null = null;
  private _rgPath: string | undefined;

  constructor(private config: VercelSandboxConfig = {}) {
    this.workingDirectory = config.cwd ?? "/vercel/sandbox";
    this.timeout = config.timeout ?? 300000;
    this.sandboxId = config.sandboxId;
  }

  private async getSbx(): Promise<VercelSandboxImpl> {
    if (this.sbxInstance) return this.sbxInstance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      let sbx: VercelSandboxImpl;
      if (this.config.sandboxId) {
        sbx = await VercelSandboxImpl.get({ sandboxId: this.config.sandboxId });
      } else {
        const createOpts: Parameters<typeof VercelSandboxImpl.create>[0] = {
          runtime: this.config.runtime ?? "node22",
          resources: this.config.resources ?? { vcpus: 2 },
          timeout: this.timeout,
        };
        if (this.config.teamId && this.config.token) {
          (createOpts as Record<string, unknown>).teamId = this.config.teamId;
          (createOpts as Record<string, unknown>).token = this.config.token;
        }
        sbx = await VercelSandboxImpl.create(createOpts);
      }

      this.sandboxId = sbx.sandboxId;
      this.sbxInstance = sbx;

      // Auto-provision ripgrep for grep operations
      if (this.config.ensureTools !== false) {
        this._rgPath = await this.ensureRipgrep(sbx);
      }

      return sbx;
    })();

    return this.initPromise;
  }

  private async ensureRipgrep(sbx: VercelSandboxImpl): Promise<string | undefined> {
    try {
      // Check if rg is already available
      const check = await sbx.runCommand({ cmd: "which", args: ["rg"], cwd: this.workingDirectory });
      const rgBin = (await check.stdout()).trim();
      if (rgBin) return rgBin;

      // Try to install via apt
      const install = await sbx.runCommand({
        cmd: "bash",
        args: ["-c", "apt-get install -y ripgrep 2>/dev/null && which rg"],
        cwd: this.workingDirectory,
      });
      const installed = (await install.stdout()).trim();
      if (installed) return installed;
    } catch {}

    return undefined;
  }

  private resolvePath(path: string): string {
    return path.startsWith("/") ? path : `${this.workingDirectory}/${path}`;
  }

  get rgPath() {
    return this._rgPath;
  }

  set rgPath(path: string | undefined) {
    this._rgPath = path;
  }

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    const sbx = await this.getSbx();
    const startTime = performance.now();
    let interrupted = false;

    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (options?.timeout) {
      timeoutId = setTimeout(() => {
        interrupted = true;
        abortController.abort();
      }, options.timeout);
    }

    try {
      const result = await sbx.runCommand({
        cmd: "bash",
        args: ["-c", command],
        cwd: options?.cwd ?? this.workingDirectory,
        signal: abortController.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      const stdout = await result.stdout();
      const stderr = await result.stderr();

      return {
        stdout,
        stderr,
        exitCode: result.exitCode ?? 0,
        durationMs: Math.round(performance.now() - startTime),
        interrupted,
      };
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const durationMs = Math.round(performance.now() - startTime);

      if (interrupted) {
        return { stdout: "", stderr: "Command timed out", exitCode: 124, durationMs, interrupted: true };
      }

      return {
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: 1,
        durationMs,
        interrupted: false,
      };
    }
  }

  async readFile(path: string): Promise<string> {
    const sbx = await this.getSbx();
    const fullPath = this.resolvePath(path);
    const buf = await sbx.readFileToBuffer({ path: fullPath });
    if (buf === null) throw new Error(`File not found: ${fullPath}`);
    return buf.toString();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const sbx = await this.getSbx();
    const fullPath = this.resolvePath(path);
    await sbx.writeFiles([{ path: fullPath, content: Buffer.from(content) }]);
  }

  async readDir(path: string): Promise<DirEntry[]> {
    const sbx = await this.getSbx();
    const fullPath = this.resolvePath(path);
    const result = await sbx.runCommand({ cmd: "bash", args: ["-c", `ls -la "${fullPath}" 2>/dev/null | tail -n +2`], cwd: this.workingDirectory });
    const stdout = await result.stdout();
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line: string) => {
        const parts = line.split(/\s+/);
        const name = parts[parts.length - 1];
        const isDirectory = line.startsWith("d");
        return { name, isDirectory };
      })
      .filter((e: { name: string; isDirectory: boolean }) => e.name && e.name !== "." && e.name !== "..");
  }

  async fileExists(path: string): Promise<boolean> {
    const sbx = await this.getSbx();
    const fullPath = this.resolvePath(path);
    const result = await sbx.runCommand({ cmd: "bash", args: ["-c", `test -e "${fullPath}" && echo "yes" || echo "no"`], cwd: this.workingDirectory });
    const out = await result.stdout();
    return out.trim() === "yes";
  }

  async isDirectory(path: string): Promise<boolean> {
    const sbx = await this.getSbx();
    const fullPath = this.resolvePath(path);
    const result = await sbx.runCommand({ cmd: "bash", args: ["-c", `test -d "${fullPath}" && echo "yes" || echo "no"`], cwd: this.workingDirectory });
    const out = await result.stdout();
    return out.trim() === "yes";
  }

  async destroy(): Promise<void> {
    if (this.sbxInstance) {
      await this.sbxInstance.stop();
      this.sbxInstance = null;
    }
  }

  get id() {
    return this.sandboxId;
  }
}
