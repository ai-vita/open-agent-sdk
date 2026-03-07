import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVercelSandbox } from "./index.js";

// Mock the @vercel/sandbox module
const mockCommandResult = {
  stdout: vi.fn(async () => "output"),
  stderr: vi.fn(async () => ""),
  exitCode: 0,
};

const mockVercelInstance = {
  sandboxId: "mock-vercel-sandbox-123",
  runCommand: vi.fn(async () => mockCommandResult),
  exec: vi.fn(async () => mockCommandResult),
  readFile: vi.fn(async () => ({ content: "file content" as string | undefined })),
  writeFile: vi.fn(async () => undefined),
  destroy: vi.fn(async () => undefined),
};

const mockVercelClass = {
  create: vi.fn(async () => mockVercelInstance),
  get: vi.fn(async () => mockVercelInstance),
};

vi.mock("@vercel/sandbox", () => ({
  Sandbox: mockVercelClass,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCommandResult.stdout.mockResolvedValue("output");
  mockCommandResult.stderr.mockResolvedValue("");
  mockVercelInstance.runCommand.mockResolvedValue(mockCommandResult);
  mockVercelInstance.exec.mockResolvedValue(mockCommandResult);
  mockVercelInstance.readFile.mockResolvedValue({ content: "file content" });
  mockVercelInstance.writeFile.mockResolvedValue(undefined);
  mockVercelInstance.destroy.mockResolvedValue(undefined);
});

describe("createVercelSandbox", () => {
  describe("exec", () => {
    it("executes a command and returns result", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      const result = await sandbox.exec("echo hello");
      expect(result.stdout).toBe("output");
      expect(result.exitCode).toBe(0);
      expect(result.interrupted).toBe(false);
      expect(mockVercelInstance.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ cmd: "bash", args: ["-c", "echo hello"] }),
      );
    });

    it("returns non-zero exit code on failure", async () => {
      mockVercelInstance.runCommand.mockResolvedValue({
        ...mockCommandResult,
        exitCode: 1,
        stdout: vi.fn(async () => ""),
        stderr: vi.fn(async () => "error"),
      });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      const result = await sandbox.exec("false");
      expect(result.exitCode).toBe(1);
    });

    it("handles errors gracefully", async () => {
      mockVercelInstance.runCommand.mockRejectedValue(new Error("connection lost"));
      const sandbox = await createVercelSandbox({ ensureTools: false });
      const result = await sandbox.exec("echo hi");
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("connection lost");
      expect(result.interrupted).toBe(false);
    });

    it("reconnects to existing sandbox by ID", async () => {
      const sandbox = await createVercelSandbox({ sandboxId: "existing-456", ensureTools: false });
      await sandbox.exec("pwd");
      expect(mockVercelClass.get).toHaveBeenCalledWith({ sandboxId: "existing-456" });
      expect(mockVercelClass.create).not.toHaveBeenCalled();
    });

    it("uses custom cwd when provided", async () => {
      const sandbox = await createVercelSandbox({ cwd: "/custom/dir", ensureTools: false });
      await sandbox.exec("ls");
      expect(mockVercelInstance.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: "/custom/dir" }),
      );
    });
  });

  describe("filesystem operations", () => {
    it("reads a file by absolute path", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      const content = await sandbox.readFile("/vercel/sandbox/test.txt");
      expect(content).toBe("file content");
      expect(mockVercelInstance.readFile).toHaveBeenCalledWith({ path: "/vercel/sandbox/test.txt" });
    });

    it("reads a file by relative path, prepending cwd", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      const content = await sandbox.readFile("relative.txt");
      expect(content).toBe("file content");
      expect(mockVercelInstance.readFile).toHaveBeenCalledWith({
        path: "/vercel/sandbox/relative.txt",
      });
    });

    it("throws when file content is undefined", async () => {
      mockVercelInstance.readFile.mockResolvedValue({ content: undefined });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      await expect(sandbox.readFile("/vercel/sandbox/missing.txt")).rejects.toThrow(
        "File not found",
      );
    });

    it("writes a file", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      await sandbox.writeFile("/vercel/sandbox/out.txt", "hello");
      expect(mockVercelInstance.writeFile).toHaveBeenCalledWith({
        path: "/vercel/sandbox/out.txt",
        content: "hello",
      });
    });

    it("writes a file by relative path", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      await sandbox.writeFile("out.txt", "world");
      expect(mockVercelInstance.writeFile).toHaveBeenCalledWith({
        path: "/vercel/sandbox/out.txt",
        content: "world",
      });
    });

    it("readDir parses ls output into DirEntry list", async () => {
      const lsOutput =
        "drwxr-xr-x 2 root root 4096 Jan 1 subdir\n-rw-r--r-- 1 root root 100 Jan 1 file.txt";
      mockVercelInstance.exec.mockResolvedValueOnce({
        ...mockCommandResult,
        stdout: vi.fn(async () => lsOutput),
      });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      const entries = await sandbox.readDir("/vercel/sandbox");
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ name: "subdir", isDirectory: true });
      expect(entries[1]).toEqual({ name: "file.txt", isDirectory: false });
    });

    it("fileExists returns true when file exists", async () => {
      mockVercelInstance.exec.mockResolvedValueOnce({
        ...mockCommandResult,
        stdout: vi.fn(async () => "yes"),
      });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      expect(await sandbox.fileExists("/vercel/sandbox/file.txt")).toBe(true);
    });

    it("fileExists returns false when file does not exist", async () => {
      mockVercelInstance.exec.mockResolvedValueOnce({
        ...mockCommandResult,
        stdout: vi.fn(async () => "no"),
      });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      expect(await sandbox.fileExists("/vercel/sandbox/missing.txt")).toBe(false);
    });

    it("isDirectory returns true for a directory", async () => {
      mockVercelInstance.exec.mockResolvedValueOnce({
        ...mockCommandResult,
        stdout: vi.fn(async () => "yes"),
      });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      expect(await sandbox.isDirectory("/vercel/sandbox")).toBe(true);
    });

    it("isDirectory returns false for a file", async () => {
      mockVercelInstance.exec.mockResolvedValueOnce({
        ...mockCommandResult,
        stdout: vi.fn(async () => "no"),
      });
      const sandbox = await createVercelSandbox({ ensureTools: false });
      expect(await sandbox.isDirectory("/vercel/sandbox/file.txt")).toBe(false);
    });
  });

  describe("lifecycle", () => {
    it("uses lazy initialization (doesn't create sandbox until first operation)", async () => {
      await createVercelSandbox({ ensureTools: false });
      expect(mockVercelClass.create).not.toHaveBeenCalled();
    });

    it("exposes sandbox id after first operation", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      await sandbox.exec("pwd");
      expect(sandbox.id).toBe("mock-vercel-sandbox-123");
    });

    it("calls destroy on the instance on destroy()", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      await sandbox.exec("pwd"); // Initialize
      await sandbox.destroy();
      expect(mockVercelInstance.destroy).toHaveBeenCalled();
    });

    it("destroy is a no-op when sandbox was never initialized", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      await expect(sandbox.destroy()).resolves.toBeUndefined();
      expect(mockVercelInstance.destroy).not.toHaveBeenCalled();
    });
  });

  describe("rgPath", () => {
    it("exposes rgPath getter and setter", async () => {
      const sandbox = await createVercelSandbox({ ensureTools: false });
      expect(sandbox.rgPath).toBeUndefined();
      sandbox.rgPath = "/usr/bin/rg";
      expect(sandbox.rgPath).toBe("/usr/bin/rg");
    });
  });
});
