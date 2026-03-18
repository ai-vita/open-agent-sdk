import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./cli.js";

describe("parseCliArgs", () => {
  it("returns defaults with no args", () => {
    const flags = parseCliArgs([]);
    expect(flags.help).toBe(false);
    expect(flags.version).toBe(false);
    expect(flags.continue).toBe(false);
    expect(flags.resume).toBeUndefined();
    expect(flags.bareResume).toBe(false);
    expect(flags.model).toBe("anthropic/claude-sonnet-4.6");
  });

  it("parses --help", () => {
    expect(parseCliArgs(["--help"]).help).toBe(true);
  });

  it("parses -h shorthand", () => {
    expect(parseCliArgs(["-h"]).help).toBe(true);
  });

  it("parses --version", () => {
    expect(parseCliArgs(["--version"]).version).toBe(true);
  });

  it("parses -v shorthand", () => {
    expect(parseCliArgs(["-v"]).version).toBe(true);
  });

  it("parses --continue / -c", () => {
    expect(parseCliArgs(["--continue"]).continue).toBe(true);
    expect(parseCliArgs(["-c"]).continue).toBe(true);
  });

  it("parses --resume with id", () => {
    const flags = parseCliArgs(["--resume", "2026-03-18T10"]);
    expect(flags.resume).toBe("2026-03-18T10");
    expect(flags.bareResume).toBe(false);
  });

  it("parses bare --resume (no id)", () => {
    const flags = parseCliArgs(["--resume"]);
    expect(flags.bareResume).toBe(true);
    expect(flags.resume).toBeUndefined();
  });

  it("parses bare -r (no id)", () => {
    const flags = parseCliArgs(["-r"]);
    expect(flags.bareResume).toBe(true);
  });

  it("parses --model with value", () => {
    expect(parseCliArgs(["--model", "openai/gpt-4o"]).model).toBe("openai/gpt-4o");
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--unknown"])).toThrow();
  });
});
