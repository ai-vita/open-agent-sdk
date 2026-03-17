import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./cli.js";

describe("parseCliArgs", () => {
  it("returns defaults with no args", () => {
    const flags = parseCliArgs([]);
    expect(flags.help).toBe(false);
    expect(flags.version).toBe(false);
    expect(flags.new).toBe(false);
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

  it("parses --new", () => {
    expect(parseCliArgs(["--new"]).new).toBe(true);
  });

  it("parses --model with value", () => {
    expect(parseCliArgs(["--model", "openai/gpt-4o"]).model).toBe("openai/gpt-4o");
  });

  it("rejects unknown flags", () => {
    expect(() => parseCliArgs(["--unknown"])).toThrow();
  });
});
