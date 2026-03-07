import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";
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
 * Creates an E2B cloud sandbox implementing the Sandbox interface.
 * Uses lazy initialization — the sandbox is not provisioned until the first operation.
 * Supports reconnection via sandboxId.
 */
export async function createE2BSandbox(config: E2BSandboxConfig = {}): Promise<Sandbox> {
  const workingDirectory = config.cwd ?? "/home/user";
  const timeout = config.timeout ?? 300000;
  let sandboxId: string | undefined = config.sandboxId;

  // Lazy singleton — prevents race conditions with concurrent tool calls
  let e2bInstance: InstanceType<typeof E2BSandbox> | null = null;
  let initPromise: Promise<InstanceType<typeof E2BSandbox>> | null = null;

  async function getE2B(): Promise<InstanceType<typeof E2BSandbox>> {
    if (e2bInstance) return e2bInstance;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      let sbx: InstanceType<typeof E2BSandbox>;
      if (config.sandboxId) {
        sbx = await E2BSandbox.connect(config.sandboxId);
      } else {
        sbx = await E2BSandbox.create({
          apiKey: config.apiKey,
          timeoutMs: timeout,
          metadata: config.metadata,
        });
        sandboxId = sbx.sandboxId;
      }

      e2bInstance = sbx;
      return sbx;
    })();

    return initPromise;
  }

  return {
    async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
      const sbx = await getE2B();
      const startTime = performance.now();

      try {
        const result = await sbx.commands.run(command, {
          cwd: options?.cwd ?? workingDirectory,
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
    },

    async readFile(path: string): Promise<string> {
      const sbx = await getE2B();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      return sbx.files.read(fullPath) as Promise<string>;
    },

    async writeFile(path: string, content: string): Promise<void> {
      const sbx = await getE2B();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      await sbx.files.write(fullPath, content);
    },

    async readDir(path: string): Promise<DirEntry[]> {
      const sbx = await getE2B();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      const entries = await sbx.files.list(fullPath) as Array<{ name: string; type?: string; isDir?: boolean }>;
      return entries.map((e) => ({
        name: e.name,
        isDirectory: e.type === "dir" || e.isDir === true,
      }));
    },

    async fileExists(path: string): Promise<boolean> {
      const sbx = await getE2B();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
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
    },

    async isDirectory(path: string): Promise<boolean> {
      const sbx = await getE2B();
      const fullPath = path.startsWith("/") ? path : `${workingDirectory}/${path}`;
      try {
        await sbx.files.list(fullPath);
        return true;
      } catch {
        return false;
      }
    },

    async destroy(): Promise<void> {
      if (e2bInstance) {
        await e2bInstance.kill();
        e2bInstance = null;
      }
    },

    get id() {
      return sandboxId;
    },
  };
}

