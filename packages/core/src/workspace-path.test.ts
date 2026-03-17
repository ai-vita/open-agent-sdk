import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "./workspace-path.js";

describe("resolveWorkspacePath", () => {
  const root = "/workspace";

  it("returns absolute path within root unchanged", () => {
    expect(resolveWorkspacePath(root, "/workspace/src/index.ts")).toBe("/workspace/src/index.ts");
  });

  it("resolves relative path against root", () => {
    expect(resolveWorkspacePath(root, "src/index.ts")).toBe("/workspace/src/index.ts");
  });

  it("resolves dot-dot within root", () => {
    expect(resolveWorkspacePath(root, "/workspace/src/../lib/util.ts")).toBe("/workspace/lib/util.ts");
  });

  it("throws on absolute path escaping root via dot-dot", () => {
    expect(() => resolveWorkspacePath(root, "/workspace/../../etc/passwd")).toThrow("outside the workspace");
  });

  it("throws on relative path escaping root", () => {
    expect(() => resolveWorkspacePath(root, "../../etc/passwd")).toThrow("outside the workspace");
  });

  it("returns root for empty path", () => {
    expect(resolveWorkspacePath(root, "")).toBe("/workspace");
  });

  it("strips trailing slash", () => {
    expect(resolveWorkspacePath(root, "/workspace/src/")).toBe("/workspace/src");
  });

  it("normalizes double slashes", () => {
    expect(resolveWorkspacePath(root, "/workspace//src//index.ts")).toBe("/workspace/src/index.ts");
  });

  it("normalizes single dot component", () => {
    expect(resolveWorkspacePath(root, "/workspace/./src/./index.ts")).toBe("/workspace/src/index.ts");
  });
});
