import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";
import { tool, zodSchema } from "ai";
import { z } from "zod";

export interface GrepMatch {
  file: string;
  line_number?: number;
  line: string;
  before_context?: string[];
  after_context?: string[];
}

export interface GrepContentOutput {
  matches: GrepMatch[];
  total_matches: number;
}

export interface GrepFilesOutput {
  files: string[];
  count: number;
}

export interface GrepCountOutput {
  counts: Array<{ file: string; count: number }>;
  total: number;
}

export interface GrepError {
  error: string;
}

export type GrepOutput = GrepContentOutput | GrepFilesOutput | GrepCountOutput;

const grepInputSchema = z.object({
  pattern: z.string().describe("Regular expression pattern to search for"),
  path: z
    .string()
    .nullable()
    .default(null)
    .describe("File or directory to search in (defaults to cwd)"),
  glob: z.string().nullable().default(null).describe('Glob pattern to filter files (e.g. "*.ts")'),
  output_mode: z
    .enum(["content", "files_with_matches", "count"])
    .nullable()
    .default(null)
    .describe(
      '"content" shows matching lines, "files_with_matches" shows file paths (default), "count" shows match counts',
    ),
  "-i": z.boolean().nullable().default(null).describe("Case insensitive search"),
  "-B": z
    .number()
    .nullable()
    .default(null)
    .describe("Lines to show before each match (content mode only)"),
  "-A": z
    .number()
    .nullable()
    .default(null)
    .describe("Lines to show after each match (content mode only)"),
  head_limit: z.number().nullable().default(null).describe("Limit output to first N entries"),
  offset: z.number().nullable().default(null).describe("Skip first N entries"),
});

type GrepInput = z.infer<typeof grepInputSchema>;

const GREP_DESCRIPTION = `Search for a regex pattern across files.

- Supports full regex syntax
- Filter files with the glob parameter (e.g., "*.ts")
- Output modes: "files_with_matches" (default), "content" (shows lines), "count"`;

// Ripgrep JSON output types
interface RgMessage {
  type: "begin" | "match" | "end" | "context" | "summary";
  data: unknown;
}

export function createGrepTool(sandbox: Sandbox, config?: ToolConfig) {
  return tool({
    description: GREP_DESCRIPTION,
    inputSchema: zodSchema(grepInputSchema),
    strict: config?.strict,
    needsApproval: config?.needsApproval,
    providerOptions: config?.providerOptions,
    execute: async (input: GrepInput): Promise<GrepOutput | GrepError> => {
      const {
        pattern,
        path,
        glob,
        output_mode: rawMode,
        "-i": caseInsensitive,
        "-B": beforeCtx,
        "-A": afterCtx,
        head_limit,
        offset: rawOffset,
      } = input;
      const output_mode = rawMode ?? "files_with_matches";
      const offset = rawOffset ?? 0;
      const searchPath = path ?? ".";

      if (config?.allowedPaths) {
        const allowed = config.allowedPaths.some((p) => searchPath.startsWith(p));
        if (!allowed) return { error: `Path not allowed: ${searchPath}` };
      }

      try {
        // Use ripgrep if available, otherwise fallback to grep
        const rgPath = sandbox.rgPath;

        if (rgPath) {
          return runWithRipgrep({
            rgPath,
            sandbox,
            pattern,
            searchPath,
            output_mode,
            caseInsensitive: caseInsensitive ?? false,
            beforeCtx: beforeCtx ?? 0,
            afterCtx: afterCtx ?? 0,
            glob,
            head_limit,
            offset,
            timeout: config?.timeout,
          });
        }

        // Fallback: use grep
        return runWithGrep({
          sandbox,
          pattern,
          searchPath,
          output_mode,
          caseInsensitive: caseInsensitive ?? false,
          glob,
          head_limit,
          offset,
          timeout: config?.timeout,
        });
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  });
}

async function runWithRipgrep(opts: {
  rgPath: string;
  sandbox: Sandbox;
  pattern: string;
  searchPath: string;
  output_mode: string;
  caseInsensitive: boolean;
  beforeCtx: number;
  afterCtx: number;
  glob: string | null;
  head_limit: number | null;
  offset: number;
  timeout?: number;
}): Promise<GrepOutput | GrepError> {
  const flags: string[] = ["--json"];

  if (opts.caseInsensitive) flags.push("-i");
  if (opts.output_mode === "content") {
    if (opts.beforeCtx) flags.push(`-B ${opts.beforeCtx}`);
    if (opts.afterCtx) flags.push(`-A ${opts.afterCtx}`);
  }
  if (opts.glob) flags.push(`-g "${opts.glob}"`);

  const cmd = `${opts.rgPath} ${flags.join(" ")} "${opts.pattern}" ${opts.searchPath} 2>/dev/null`;
  const result = await opts.sandbox.exec(cmd, { timeout: opts.timeout });

  if (opts.output_mode === "files_with_matches") {
    return parseRgFiles(result.stdout, opts.head_limit, opts.offset);
  } else if (opts.output_mode === "count") {
    return parseRgCount(result.stdout);
  } else {
    return parseRgContent(result.stdout, opts.head_limit, opts.offset);
  }
}

async function runWithGrep(opts: {
  sandbox: Sandbox;
  pattern: string;
  searchPath: string;
  output_mode: string;
  caseInsensitive: boolean;
  glob: string | null;
  head_limit: number | null;
  offset: number;
  timeout?: number;
}): Promise<GrepOutput | GrepError> {
  const flags: string[] = ["-r", "--include=*"];

  if (opts.caseInsensitive) flags.push("-i");

  // Add glob filter
  if (opts.glob) {
    // Convert glob to include pattern for grep
    flags.pop();
    flags.push(`--include="${opts.glob}"`);
  }

  if (opts.output_mode === "files_with_matches") {
    flags.push("-l");
  } else if (opts.output_mode === "count") {
    flags.push("-c");
  } else {
    flags.push("-n");
  }

  const cmd = `grep ${flags.join(" ")} "${opts.pattern}" ${opts.searchPath} 2>/dev/null`;
  const result = await opts.sandbox.exec(cmd, { timeout: opts.timeout });

  if (opts.output_mode === "files_with_matches") {
    let files = result.stdout.split("\n").filter(Boolean);
    if (opts.offset > 0) files = files.slice(opts.offset);
    if (opts.head_limit && opts.head_limit > 0) files = files.slice(0, opts.head_limit);
    return { files, count: files.length };
  } else if (opts.output_mode === "count") {
    const counts = result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const colonIdx = line.lastIndexOf(":");
        const file = line.slice(0, colonIdx);
        const count = parseInt(line.slice(colonIdx + 1), 10);
        return { file, count: Number.isNaN(count) ? 0 : count };
      })
      .filter((e) => e.count > 0);
    return { counts, total: counts.reduce((s, c) => s + c.count, 0) };
  } else {
    // content mode
    const matches: GrepMatch[] = result.stdout
      .split("\n")
      .filter(Boolean)
      .map((line): GrepMatch | null => {
        const colonIdx = line.indexOf(":");
        const secondColon = line.indexOf(":", colonIdx + 1);
        if (colonIdx === -1 || secondColon === -1) return null;
        const file = line.slice(0, colonIdx);
        const lineNum = parseInt(line.slice(colonIdx + 1, secondColon), 10);
        const content = line.slice(secondColon + 1);
        return { file, line_number: lineNum, line: content };
      })
      .filter((m): m is GrepMatch => m !== null);

    let result2 = matches;
    if (opts.offset > 0) result2 = result2.slice(opts.offset);
    if (opts.head_limit && opts.head_limit > 0) result2 = result2.slice(0, opts.head_limit);
    return { matches: result2, total_matches: result2.length };
  }
}

function parseRgFiles(stdout: string, headLimit: number | null, offset: number): GrepFilesOutput {
  const files = new Set<string>();
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const msg: RgMessage = JSON.parse(line);
      if (msg.type === "begin") {
        const data = msg.data as { path: { text: string } };
        files.add(data.path.text);
      }
    } catch {}
  }
  let result = Array.from(files);
  if (offset > 0) result = result.slice(offset);
  if (headLimit && headLimit > 0) result = result.slice(0, headLimit);
  return { files: result, count: result.length };
}

function parseRgCount(stdout: string): GrepCountOutput {
  const counts = new Map<string, number>();
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const msg: RgMessage = JSON.parse(line);
      if (msg.type === "end") {
        const data = msg.data as { path: { text: string }; stats: { matches: number } };
        counts.set(data.path.text, data.stats.matches);
      }
    } catch {}
  }
  const arr = Array.from(counts.entries()).map(([file, count]) => ({ file, count }));
  return { counts: arr, total: arr.reduce((s, c) => s + c.count, 0) };
}

function parseRgContent(
  stdout: string,
  headLimit: number | null,
  offset: number,
): GrepContentOutput {
  const matches: GrepMatch[] = [];
  for (const line of stdout.split("\n").filter(Boolean)) {
    try {
      const msg: RgMessage = JSON.parse(line);
      if (msg.type === "match") {
        const data = msg.data as {
          path: { text: string };
          lines: { text: string };
          line_number: number;
        };
        matches.push({
          file: data.path.text,
          line_number: data.line_number,
          line: data.lines.text.replace(/\n$/, ""),
        });
      }
    } catch {}
  }
  let result = matches;
  if (offset > 0) result = result.slice(offset);
  if (headLimit && headLimit > 0) result = result.slice(0, headLimit);
  return { matches: result, total_matches: result.length };
}
