import type { ExecResult, Sandbox } from "@open-agent-sdk/core";
import { describe, expect, it, vi } from "vitest";
import { createAgentTools } from "./agent-tools.js";
import { createAskUserTool } from "./ask-user.js";
import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createGlobTool } from "./glob.js";
import { createEnterPlanModeTool, createExitPlanModeTool } from "./plan-mode.js";
import { createReadTool } from "./read.js";
import { createTodoWriteTool } from "./todo-write.js";
import { createWriteTool } from "./write.js";

function mockExecResult(overrides: Partial<ExecResult> = {}): ExecResult {
  return {
    stdout: "",
    stderr: "",
    exitCode: 0,
    durationMs: 10,
    interrupted: false,
    ...overrides,
  };
}

function createMockSandbox(overrides: Partial<Sandbox> = {}): Sandbox {
  return {
    exec: vi.fn(async () => mockExecResult()),
    readFile: vi.fn(async () => "file content"),
    writeFile: vi.fn(async () => undefined),
    readDir: vi.fn(async () => []),
    fileExists: vi.fn(async () => true),
    isDirectory: vi.fn(async () => false),
    destroy: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("createBashTool", () => {
  it("executes command and returns result", async () => {
    const sandbox = createMockSandbox({
      exec: vi.fn(async () => mockExecResult({ stdout: "hello\n", exitCode: 0 })),
    });
    const tool = createBashTool(sandbox);
    const result = await tool.execute?.(
      { command: "echo hello", timeout: null, description: null, run_in_background: null },
      undefined as never,
    );
    expect((result as { stdout: string }).stdout).toBe("hello\n");
  });

  it("blocks commands containing blocked terms", async () => {
    const sandbox = createMockSandbox();
    const tool = createBashTool(sandbox, { blockedCommands: ["rm -rf"] });
    const result = await tool.execute?.(
      { command: "rm -rf /", timeout: null, description: null, run_in_background: null },
      undefined as never,
    );
    expect((result as { error: string }).error).toContain("blocked");
  });

  it("truncates long output", async () => {
    const longOutput = "x".repeat(50000);
    const sandbox = createMockSandbox({
      exec: vi.fn(async () => mockExecResult({ stdout: longOutput })),
    });
    const tool = createBashTool(sandbox, { maxOutputLength: 100 });
    const result = await tool.execute?.(
      { command: "cmd", timeout: null, description: null, run_in_background: null },
      undefined as never,
    );
    expect((result as { stdout: string }).stdout).toContain("truncated");
  });
});

describe("createReadTool", () => {
  it("reads file content with line numbers", async () => {
    const sandbox = createMockSandbox({
      readFile: vi.fn(async () => "line1\nline2\nline3"),
    });
    const tool = createReadTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/test.txt", offset: null, limit: null },
      undefined as never,
    );
    const output = result as {
      type: string;
      lines: Array<{ line_number: number; content: string }>;
    };
    expect(output.type).toBe("text");
    expect(output.lines[0].line_number).toBe(1);
    expect(output.lines[0].content).toBe("line1");
  });

  it("returns error for non-existent file", async () => {
    const sandbox = createMockSandbox({ fileExists: vi.fn(async () => false) });
    const tool = createReadTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/ghost.txt", offset: null, limit: null },
      undefined as never,
    );
    expect((result as { error: string }).error).toContain("not found");
  });

  it("reads directory entries", async () => {
    const sandbox = createMockSandbox({
      isDirectory: vi.fn(async () => true),
      readDir: vi.fn(async () => [
        { name: "a.txt", isDirectory: false },
        { name: "b/", isDirectory: true },
      ]),
    });
    const tool = createReadTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/dir", offset: null, limit: null },
      undefined as never,
    );
    expect((result as { type: string }).type).toBe("directory");
  });

  it("respects offset and limit", async () => {
    const sandbox = createMockSandbox({
      readFile: vi.fn(async () => Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join("\n")),
    });
    const tool = createReadTool(sandbox, { maxFileSize: 1000 });
    const result = await tool.execute?.(
      { file_path: "/test.txt", offset: 3, limit: 2 },
      undefined as never,
    );
    const output = result as { lines: Array<{ line_number: number; content: string }> };
    expect(output.lines.length).toBe(2);
    expect(output.lines[0].line_number).toBe(3);
  });
});

describe("createWriteTool", () => {
  it("writes content to file", async () => {
    const sandbox = createMockSandbox();
    const tool = createWriteTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/test.txt", content: "hello" },
      undefined as never,
    );
    expect(sandbox.writeFile as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "/test.txt",
      "hello",
    );
    expect((result as { message: string }).message).toContain("Successfully");
  });

  it("returns error for disallowed path", async () => {
    const sandbox = createMockSandbox();
    const tool = createWriteTool(sandbox, { allowedPaths: ["/allowed"] });
    const result = await tool.execute?.(
      { file_path: "/forbidden/file.txt", content: "x" },
      undefined as never,
    );
    expect((result as { error: string }).error).toContain("not allowed");
  });
});

describe("createEditTool", () => {
  it("replaces a string in file", async () => {
    const sandbox = createMockSandbox({
      readFile: vi.fn(async () => "hello world"),
    });
    const tool = createEditTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/test.txt", old_string: "world", new_string: "earth", replace_all: null },
      undefined as never,
    );
    expect((result as { replacements: number }).replacements).toBe(1);
  });

  it("returns error when old_string not found", async () => {
    const sandbox = createMockSandbox({
      readFile: vi.fn(async () => "hello world"),
    });
    const tool = createEditTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/test.txt", old_string: "missing", new_string: "new", replace_all: null },
      undefined as never,
    );
    expect((result as { error: string }).error).toContain("not found");
  });

  it("rejects when old and new strings are identical", async () => {
    const sandbox = createMockSandbox();
    const tool = createEditTool(sandbox);
    const result = await tool.execute?.(
      { file_path: "/test.txt", old_string: "same", new_string: "same", replace_all: null },
      undefined as never,
    );
    expect((result as { error: string }).error).toContain("must be different");
  });
});

describe("createGlobTool", () => {
  it("returns file matches", async () => {
    const sandbox = createMockSandbox({
      exec: vi.fn(async () => mockExecResult({ stdout: "./a.ts\n./b.ts\n" })),
    });
    const tool = createGlobTool(sandbox);
    const result = await tool.execute?.({ pattern: "**/*.ts", path: null }, undefined as never);
    expect((result as { count: number }).count).toBe(2);
  });

  it("returns empty list when no matches", async () => {
    const sandbox = createMockSandbox({
      exec: vi.fn(async () => mockExecResult({ stdout: "" })),
    });
    const tool = createGlobTool(sandbox);
    const result = await tool.execute?.({ pattern: "**/*.xyz", path: null }, undefined as never);
    expect((result as { matches: unknown[] }).matches).toHaveLength(0);
  });
});

describe("createAskUserTool", () => {
  it("invokes onQuestion callback and returns answer", async () => {
    const tool = createAskUserTool(async (q) => `Answer to: ${q}`);
    const result = await tool.execute?.(
      { question: "What's up?", options: null },
      undefined as never,
    );
    expect((result as { answer: string }).answer).toBe("Answer to: What's up?");
  });

  it("returns awaiting_response when no handler", async () => {
    const tool = createAskUserTool();
    const result = await tool.execute?.(
      { question: "What's up?", options: null },
      undefined as never,
    );
    expect((result as { awaiting_response: boolean }).awaiting_response).toBe(true);
  });
});

describe("createEnterPlanModeTool / createExitPlanModeTool", () => {
  it("activates plan mode state", async () => {
    const state = { isActive: false };
    const enterTool = createEnterPlanModeTool(state);
    await enterTool.execute?.({ reason: "exploring" }, undefined as never);
    expect(state.isActive).toBe(true);
  });

  it("returns error when already in plan mode", async () => {
    const state = { isActive: true };
    const enterTool = createEnterPlanModeTool(state);
    const result = await enterTool.execute?.({ reason: "again" }, undefined as never);
    expect((result as { error: string }).error).toContain("Already in planning mode");
  });

  it("exits plan mode and returns plan", async () => {
    const exitTool = createExitPlanModeTool();
    const result = await exitTool.execute?.({ plan: "Step 1: do X" }, undefined as never);
    expect((result as { message: string }).message).toContain("Plan submitted");
  });
});

describe("createTodoWriteTool", () => {
  it("updates state and returns stats", async () => {
    const state = { todos: [] };
    const tool = createTodoWriteTool(state);
    const result = await tool.execute?.(
      {
        todos: [
          { content: "Task 1", status: "in_progress", activeForm: "Doing task 1" },
          { content: "Task 2", status: "pending", activeForm: "Doing task 2" },
        ],
      },
      undefined as never,
    );
    expect(state.todos).toHaveLength(2);
    expect((result as { stats: { total: number } }).stats.total).toBe(2);
  });
});

describe("createAgentTools", () => {
  it("returns core sandbox tools by default", () => {
    const sandbox = createMockSandbox();
    const { tools } = createAgentTools(sandbox);
    expect(Object.keys(tools)).toContain("Bash");
    expect(Object.keys(tools)).toContain("Read");
    expect(Object.keys(tools)).toContain("Write");
    expect(Object.keys(tools)).toContain("Edit");
    expect(Object.keys(tools)).toContain("Glob");
    expect(Object.keys(tools)).toContain("Grep");
  });

  it("excludes optional tools by default", () => {
    const sandbox = createMockSandbox();
    const { tools } = createAgentTools(sandbox);
    expect(Object.keys(tools)).not.toContain("AskUser");
    expect(Object.keys(tools)).not.toContain("EnterPlanMode");
    expect(Object.keys(tools)).not.toContain("WebSearch");
  });

  it("includes AskUser when configured", () => {
    const sandbox = createMockSandbox();
    const { tools } = createAgentTools(sandbox, { askUser: {} });
    expect(Object.keys(tools)).toContain("AskUser");
  });

  it("includes plan mode tools when configured", () => {
    const sandbox = createMockSandbox();
    const { tools, planModeState } = createAgentTools(sandbox, { planMode: true });
    expect(Object.keys(tools)).toContain("EnterPlanMode");
    expect(Object.keys(tools)).toContain("ExitPlanMode");
    expect(planModeState).toBeDefined();
    expect(planModeState?.isActive).toBe(false);
  });

  it("wraps tools with cache when cache: true", () => {
    const sandbox = createMockSandbox();
    const { tools } = createAgentTools(sandbox, { cache: true });
    // Cached tools have getStats method
    expect(typeof (tools.Read as { getStats?: unknown }).getStats).toBe("function");
    // Bash should NOT be cached by default
    expect(typeof (tools.Bash as { getStats?: unknown }).getStats).toBe("undefined");
  });
});
