import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalSandbox } from "./index.js";

let tmpDir: string;
let sandbox: LocalSandbox;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "sandbox-test-"));
  sandbox = new LocalSandbox({ cwd: tmpDir });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("exec", () => {
  it("executes a simple command", async () => {
    const result = await sandbox.exec("echo hello");
    expect(result.stdout.trim()).toBe("hello");
    expect(result.exitCode).toBe(0);
    expect(result.interrupted).toBe(false);
  });

  it("returns non-zero exit code without throwing", async () => {
    const result = await sandbox.exec("exit 42", {});
    expect(result.exitCode).toBe(42);
  });

  it("captures stderr", async () => {
    const result = await sandbox.exec("echo err >&2");
    expect(result.stderr.trim()).toBe("err");
  });

  it("terminates on timeout", async () => {
    const start = Date.now();
    const result = await sandbox.exec("sleep 10", { timeout: 200 });
    const elapsed = Date.now() - start;
    expect(result.interrupted).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe("filesystem operations", () => {
  it("writes and reads a file", async () => {
    const path = join(tmpDir, "test.txt");
    await sandbox.writeFile(path, "hello world");
    const content = await sandbox.readFile(path);
    expect(content).toBe("hello world");
  });

  it("creates parent directories on write", async () => {
    const path = join(tmpDir, "a/b/c/file.txt");
    await sandbox.writeFile(path, "nested");
    const content = await sandbox.readFile(path);
    expect(content).toBe("nested");
  });

  it("throws when reading non-existent file", async () => {
    await expect(sandbox.readFile(join(tmpDir, "ghost.txt"))).rejects.toThrow();
  });

  it("fileExists returns true for existing file", async () => {
    const path = join(tmpDir, "exists.txt");
    await sandbox.writeFile(path, "x");
    expect(await sandbox.fileExists(path)).toBe(true);
  });

  it("fileExists returns false for missing file", async () => {
    expect(await sandbox.fileExists(join(tmpDir, "nope.txt"))).toBe(false);
  });

  it("isDirectory returns true for directory", async () => {
    expect(await sandbox.isDirectory(tmpDir)).toBe(true);
  });

  it("isDirectory returns false for file", async () => {
    const path = join(tmpDir, "file.txt");
    await sandbox.writeFile(path, "x");
    expect(await sandbox.isDirectory(path)).toBe(false);
  });

  it("readDir lists directory entries", async () => {
    await sandbox.writeFile(join(tmpDir, "a.txt"), "a");
    await sandbox.writeFile(join(tmpDir, "b.txt"), "b");
    const entries = await sandbox.readDir(tmpDir);
    const names = entries.map((e) => e.name).sort();
    expect(names).toContain("a.txt");
    expect(names).toContain("b.txt");
    expect(entries.find((e) => e.name === "a.txt")?.isDirectory).toBe(false);
  });
});

describe("destroy", () => {
  it("resolves without error", async () => {
    await expect(sandbox.destroy()).resolves.toBeUndefined();
  });
});
