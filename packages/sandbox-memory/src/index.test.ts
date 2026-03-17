import { describe, expect, it } from "vitest";
import { MemorySandbox } from "./index.js";

describe("MemorySandbox", () => {
  it("constructs with initial files", async () => {
    const sandbox = new MemorySandbox({
      initialFiles: { "/workspace/hello.txt": "world" },
    });
    expect(await sandbox.readFile("/workspace/hello.txt")).toBe("world");
  });

  it("constructs with empty state", async () => {
    const sandbox = new MemorySandbox();
    const entries = await sandbox.readDir("/");
    expect(entries).toEqual([]);
  });

  it("write then read a file", async () => {
    const sandbox = new MemorySandbox();
    await sandbox.writeFile("/workspace/foo.ts", "const x = 1;");
    expect(await sandbox.readFile("/workspace/foo.ts")).toBe("const x = 1;");
    expect(await sandbox.fileExists("/workspace/foo.ts")).toBe(true);
  });

  it("write creates parent directories", async () => {
    const sandbox = new MemorySandbox();
    await sandbox.writeFile("/workspace/a/b/c.txt", "deep");
    expect(await sandbox.isDirectory("/workspace/a/b")).toBe(true);
    expect(await sandbox.isDirectory("/workspace/a")).toBe(true);
  });

  it("read non-existent file throws", async () => {
    const sandbox = new MemorySandbox();
    await expect(sandbox.readFile("/workspace/missing.txt")).rejects.toThrow("ENOENT");
  });

  it("lists directory contents", async () => {
    const sandbox = new MemorySandbox({
      initialFiles: {
        "/workspace/a.ts": "a",
        "/workspace/sub/b.ts": "b",
      },
    });
    const entries = await sandbox.readDir("/workspace");
    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted).toEqual([
      { name: "a.ts", isDirectory: false },
      { name: "sub", isDirectory: true },
    ]);
  });

  it("exec echo command", async () => {
    const sandbox = new MemorySandbox();
    const result = await sandbox.exec('echo "hello"');
    expect(result.stdout).toBe("hello");
    expect(result.exitCode).toBe(0);
  });

  it("exec unsupported command returns error", async () => {
    const sandbox = new MemorySandbox();
    const result = await sandbox.exec("curl http://example.com");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not supported");
  });

  it("destroy resolves without error", async () => {
    const sandbox = new MemorySandbox();
    await expect(sandbox.destroy()).resolves.toBeUndefined();
  });
});
