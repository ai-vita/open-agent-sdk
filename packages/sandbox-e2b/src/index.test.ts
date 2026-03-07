import { describe, it, expect, vi, beforeEach } from "vitest";
import { E2BSandbox } from "./index.js";

// Mock the @e2b/code-interpreter module
const { mockE2BInstance, mockE2BClass } = vi.hoisted(() => {
  const mockE2BInstance = {
    sandboxId: "mock-sandbox-123",
    commands: {
      run: vi.fn(async () => ({ stdout: "output", stderr: "", exitCode: 0 })),
    },
    files: {
      read: vi.fn(async () => "file content"),
      write: vi.fn(async () => undefined),
      list: vi.fn(async () => [
        { name: "a.txt", type: "file" },
        { name: "subdir", type: "dir" },
      ]),
    },
    kill: vi.fn(async () => undefined),
  };
  const mockE2BClass = {
    create: vi.fn(async () => mockE2BInstance),
    connect: vi.fn(async () => mockE2BInstance),
  };
  return { mockE2BInstance, mockE2BClass };
});

vi.mock("@e2b/code-interpreter", () => ({
  Sandbox: mockE2BClass,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockE2BInstance.commands.run.mockResolvedValue({ stdout: "output", stderr: "", exitCode: 0 });
  mockE2BInstance.files.read.mockResolvedValue("file content");
});

describe("createE2BSandbox", () => {
  describe("exec", () => {
    it("executes a command and returns result", async () => {
      const sandbox = new E2BSandbox();
      const result = await sandbox.exec("echo hello");
      expect(result.stdout).toBe("output");
      expect(result.exitCode).toBe(0);
      expect(result.interrupted).toBe(false);
    });

    it("handles timeout errors", async () => {
      mockE2BInstance.commands.run.mockRejectedValue(new Error("command timed out"));
      const sandbox = new E2BSandbox();
      const result = await sandbox.exec("sleep 10", { timeout: 100 });
      expect(result.interrupted).toBe(true);
      expect(result.exitCode).toBe(124);
    });

    it("reconnects to existing sandbox by ID", async () => {
      const sandbox = new E2BSandbox({ sandboxId: "existing-123" });
      await sandbox.exec("pwd");
      expect(mockE2BClass.connect).toHaveBeenCalledWith("existing-123");
      expect(mockE2BClass.create).not.toHaveBeenCalled();
    });
  });

  describe("filesystem operations", () => {
    it("reads a file", async () => {
      const sandbox = new E2BSandbox();
      const content = await sandbox.readFile("/home/user/file.txt");
      expect(content).toBe("file content");
    });

    it("writes a file", async () => {
      const sandbox = new E2BSandbox();
      await sandbox.writeFile("/home/user/out.txt", "hello");
      expect(mockE2BInstance.files.write).toHaveBeenCalledWith(
        "/home/user/out.txt",
        "hello",
      );
    });

    it("lists directory entries", async () => {
      const sandbox = new E2BSandbox();
      const entries = await sandbox.readDir("/home/user");
      expect(entries).toHaveLength(2);
      expect(entries[0].name).toBe("a.txt");
      expect(entries[0].isDirectory).toBe(false);
      expect(entries[1].name).toBe("subdir");
      expect(entries[1].isDirectory).toBe(true);
    });
  });

  describe("lifecycle", () => {
    it("uses lazy initialization (doesn't create sandbox until first operation)", async () => {
      new E2BSandbox();
      // No operation performed, so E2B should not have been called yet
      expect(mockE2BClass.create).not.toHaveBeenCalled();
    });

    it("exposes sandbox id after first operation", async () => {
      const sandbox = new E2BSandbox();
      await sandbox.exec("pwd");
      expect(sandbox.id).toBe("mock-sandbox-123");
    });

    it("calls kill on destroy", async () => {
      const sandbox = new E2BSandbox();
      await sandbox.exec("pwd"); // Initialize
      await sandbox.destroy();
      expect(mockE2BInstance.kill).toHaveBeenCalled();
    });
  });
});
