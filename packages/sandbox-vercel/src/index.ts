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
 * Creates a Vercel Firecracker sandbox implementing the Sandbox interface.
 * Uses lazy singleton initialization — the sandbox is provisioned on first use.
 * Supports reconnection via sandboxId.
 */
export async function createVercelSandbox(
  config: VercelSandboxConfig = {},
): Promise<Sandbox> {
  const workingDirectory = config.cwd ?? "/vercel/sandbox";
  const timeout = config.timeout ?? 300000;
  let sandboxId: string | undefined = config.sandboxId;
  let rgPath: string | undefined;

  let sbxInstance: VercelSandboxInstance | null = null;
  let initPromise: Promise<VercelSandboxInstance> | null = null;

  async function getSbx(): Promise<VercelSandboxInstance> {
    if (sbxInstance) return sbxInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      let VercelSandboxSDK: VercelSandboxSDKType;
      try {
        const module = await import("@vercel/sandbox");
        VercelSandboxSDK = module.Sandbox as unknown as VercelSandboxSDKType;
      } catch {
        throw new Error(
          "@open-agent-sdk/sandbox-vercel requires @vercel/sandbox. Install with: npm install @vercel/sandbox",
        );
      }

      let sbx: VercelSandboxInstance;
      if (config.sandboxId) {
        sbx = await VercelSandboxSDK.get({ sandboxId: config.sandboxId }) as VercelSandboxInstance;
      } else {
        const createOpts: Record<string, unknown> = {
          runtime: config.runtime ?? "node22",
          resources: config.resources ?? { vcpus: 2 },
          timeout,
        };
        if (config.teamId && config.token) {
          createOpts.teamId = config.teamId;
          createOpts.token = config.token;
        }
        sbx = await VercelSandboxSDK.create(createOpts as never) as VercelSandboxInstance;
      }

      sandboxId = sbx.sandboxId;
      sbxInstance = sbx;

      // Auto-provision ripgrep for grep operations
      if (config.ensureTools !== false) {
        rgPath = await ensureRipgrep(sbx, workingDirectory);
      }

      return sbx;
    })();

    return initPromise;
  }

  const sandbox: Sandbox = {
    async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
      const sbx = await getSbx();
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
          cwd: options?.cwd ?? workingDirectory,
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
    },

    async readFile(path: string): Promise<string> {
      const sbx = await getSbx();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      const result = await sbx.readFile({ path: fullPath });
      if (result.content === undefined) throw new Error(`File not found: ${fullPath}`);
      return result.content;
    },

    async writeFile(path: string, content: string): Promise<void> {
      const sbx = await getSbx();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      await sbx.writeFile({ path: fullPath, content });
    },

    async readDir(path: string): Promise<DirEntry[]> {
      const sbx = await getSbx();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      const result = await sbx.exec("bash", ["-c", `ls -la "${fullPath}" 2>/dev/null | tail -n +2`]);
      const stdout = await result.stdout();
      return stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/\s+/);
          const name = parts[parts.length - 1];
          const isDirectory = line.startsWith("d");
          return { name, isDirectory };
        })
        .filter((e) => e.name && e.name !== "." && e.name !== "..");
    },

    async fileExists(path: string): Promise<boolean> {
      const sbx = await getSbx();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      const result = await sbx.exec("bash", ["-c", `test -e "${fullPath}" && echo "yes" || echo "no"`]);
      const out = await result.stdout();
      return out.trim() === "yes";
    },

    async isDirectory(path: string): Promise<boolean> {
      const sbx = await getSbx();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      const result = await sbx.exec("bash", ["-c", `test -d "${fullPath}" && echo "yes" || echo "no"`]);
      const out = await result.stdout();
      return out.trim() === "yes";
    },

    async destroy(): Promise<void> {
      if (sbxInstance) {
        await sbxInstance.destroy();
        sbxInstance = null;
      }
    },

    get id() {
      return sandboxId;
    },

    get rgPath() {
      return rgPath;
    },

    set rgPath(path: string | undefined) {
      rgPath = path;
    },
  };

  return sandbox;
}

/**
 * Provisions ripgrep in the sandbox and returns the binary path.
 */
async function ensureRipgrep(
  sbx: VercelSandboxInstance,
  cwd: string,
): Promise<string | undefined> {
  try {
    // Check if rg is already available
    const check = await sbx.runCommand({ cmd: "which", args: ["rg"], cwd });
    const rgBin = (await check.stdout()).trim();
    if (rgBin) return rgBin;

    // Try to install via apt
    const install = await sbx.runCommand({
      cmd: "bash",
      args: ["-c", "apt-get install -y ripgrep 2>/dev/null && which rg"],
      cwd,
    });
    const installed = (await install.stdout()).trim();
    if (installed) return installed;
  } catch {}

  return undefined;
}

// Minimal interface types for internal use
interface VercelSandboxSDKType {
  create(opts: Record<string, unknown>): Promise<VercelSandboxInstance>;
  get(opts: { sandboxId: string }): Promise<VercelSandboxInstance>;
}

interface CommandResult {
  stdout(): Promise<string>;
  stderr(): Promise<string>;
  exitCode?: number;
}

interface VercelSandboxInstance {
  sandboxId: string;
  runCommand(opts: { cmd: string; args?: string[]; cwd?: string; signal?: AbortSignal }): Promise<CommandResult>;
  exec(cmd: string, args?: string[]): Promise<CommandResult>;
  readFile(opts: { path: string }): Promise<{ content?: string }>;
  writeFile(opts: { path: string; content: string }): Promise<void>;
  destroy(): Promise<void>;
}
