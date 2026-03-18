import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionDir, listSessions, resolveSessionPath } from "./sessions.js";

// Mock homedir to use a temp directory
const testHome = path.join(tmpdir(), `oa-test-${Date.now()}`);
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => testHome };
});

const testCwd = "/tmp/test-project";

beforeEach(() => {
  mkdirSync(path.join(testHome, ".agents", "sessions"), { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getSessionDir", () => {
  it("returns deterministic path for same cwd", () => {
    const dir1 = getSessionDir(testCwd);
    const dir2 = getSessionDir(testCwd);
    expect(dir1).toBe(dir2);
  });

  it("creates metadata.json with project path", () => {
    const dir = getSessionDir(testCwd);
    const meta = JSON.parse(readFileSync(path.join(dir, "metadata.json"), "utf-8"));
    expect(meta.path).toBe(testCwd);
  });

  it("produces different dirs for different cwds", () => {
    const dir1 = getSessionDir("/tmp/project-a");
    const dir2 = getSessionDir("/tmp/project-b");
    expect(dir1).not.toBe(dir2);
  });
});

describe("resolveSessionPath", () => {
  it("returns new path by default", () => {
    const result = resolveSessionPath(testCwd, {});
    expect(result.isNew).toBe(true);
    expect(result.sessionPath).toMatch(/\.jsonl$/);
  });

  it("--continue returns most recent session", () => {
    const dir = getSessionDir(testCwd);
    writeFileSync(path.join(dir, "2026-03-18T10-00-00.jsonl"), '{"role":"user"}\n');
    writeFileSync(path.join(dir, "2026-03-18T14-00-00.jsonl"), '{"role":"user"}\n');

    const result = resolveSessionPath(testCwd, { continue: true });
    expect(result.isNew).toBe(false);
    expect(result.sessionPath).toContain("2026-03-18T14-00-00.jsonl");
  });

  it("--continue with no sessions starts fresh", () => {
    const result = resolveSessionPath(`/tmp/empty-project-${Date.now()}`, { continue: true });
    expect(result.isNew).toBe(true);
  });

  it("--resume <id> matches by timestamp prefix", () => {
    const dir = getSessionDir(testCwd);
    writeFileSync(path.join(dir, "2026-03-18T10-00-00.jsonl"), '{"role":"user"}\n');

    const result = resolveSessionPath(testCwd, { resume: "2026-03-18T10" });
    expect(result.isNew).toBe(false);
    expect(result.sessionPath).toContain("2026-03-18T10-00-00.jsonl");
  });

  it("--resume with invalid id throws", () => {
    getSessionDir(testCwd);
    expect(() => resolveSessionPath(testCwd, { resume: "nonexistent" })).toThrow(
      /No session matching/,
    );
  });

  it("bare --resume returns empty path for picker", () => {
    const result = resolveSessionPath(testCwd, { resume: true });
    expect(result.sessionPath).toBe("");
    expect(result.isNew).toBe(false);
  });
});

describe("listSessions", () => {
  it("lists sessions sorted newest first", () => {
    const dir = getSessionDir(testCwd);
    writeFileSync(path.join(dir, "2026-03-18T10-00-00.jsonl"), '{"a":1}\n{"b":2}\n');
    writeFileSync(path.join(dir, "2026-03-18T14-00-00.jsonl"), '{"c":3}\n');

    const sessions = listSessions(testCwd);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].filename).toBe("2026-03-18T14-00-00.jsonl");
    expect(sessions[0].messageCount).toBe(1);
    expect(sessions[1].messageCount).toBe(2);
  });
});
