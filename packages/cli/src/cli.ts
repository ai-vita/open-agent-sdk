/**
 * oa — Open Agent CLI
 *
 * A standalone interactive coding agent powered by Open Agent SDK.
 *
 * Usage:
 *   oa                  # start a new session
 *   oa -c / --continue  # resume the most recent session
 *   oa -r / --resume    # pick a session to resume
 *   oa -r <id>          # resume a specific session by timestamp prefix
 *   oa --model X        # use a specific model (default: anthropic/claude-sonnet-4.6)
 *   oa --help           # show help
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import { Agent, SessionManager } from "@open-agent-sdk/core";
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createSkillTool, discoverSkills, skillsToXml } from "@open-agent-sdk/skills";
import { createAgentTools } from "@open-agent-sdk/tools";
import { gateway } from "ai";
import dotenv from "dotenv";

import { formatSessionList, listSessions, resolveSessionPath } from "./sessions.js";

function loadEnv() {
  dotenv.config({ path: path.join(homedir(), ".agents", ".env") });
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

const HELP = `oa — Open Agent CLI

Usage:
  oa [options]

Options:
  -c, --continue       Resume the most recent session for this project
  -r, --resume [id]    Resume a specific session (or pick interactively)
  --model <id>         Model to use (default: anthropic/claude-sonnet-4.6)
  -h, --help           Show this help message
  -v, --version        Show version

Environment:
  AI_GATEWAY_API_KEY   API key for the AI gateway

Configuration is loaded from ~/.agents/.env (shell env vars take precedence).
The agent runs in the current working directory with access to
filesystem and shell tools. Sessions are stored in ~/.agents/sessions/.
`;

export function parseCliArgs(args: string[]) {
  // Detect bare --resume / -r (no value) before parseArgs, which requires a value for string opts.
  // A bare -r is followed by another flag (starting with -) or is the last arg.
  let bareResume = false;
  const filtered: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--resume" || args[i] === "-r") {
      const next = args[i + 1];
      if (!next || next.startsWith("-")) {
        bareResume = true;
        continue;
      }
    }
    filtered.push(args[i]);
  }

  const { values } = parseArgs({
    args: filtered,
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      continue: { type: "boolean", short: "c", default: false },
      resume: { type: "string", short: "r" },
      model: { type: "string", default: "anthropic/claude-sonnet-4.6" },
    },
    strict: true,
    allowPositionals: false,
  });
  return { ...values, bareResume };
}

async function main() {
  const flags = parseCliArgs(process.argv.slice(2));

  if (flags.help) {
    process.stdout.write(HELP);
    return;
  }

  if (flags.version) {
    console.log(getVersion());
    return;
  }

  const cwd = process.cwd();
  loadEnv();

  const { sessionPath, isNew } = resolveSessionPath(cwd, {
    continue: flags.continue,
    resume: flags.bareResume ? true : flags.resume,
  });

  let finalSessionPath = sessionPath;

  if (!isNew && sessionPath === "") {
    // Interactive picker for bare --resume
    const sessions = listSessions(cwd);
    if (sessions.length === 0) {
      console.log("No sessions found. Starting a new session.\n");
      finalSessionPath = resolveSessionPath(cwd, {}).sessionPath;
    } else {
      const rlPicker = createInterface({ input: process.stdin, output: process.stdout });
      console.log(`Sessions for ${cwd}:`);
      console.log(formatSessionList(sessions));
      const answer = await rlPicker.question("Select session [1]: ");
      rlPicker.close();
      const idx = Math.max(0, (parseInt(answer, 10) || 1) - 1);
      finalSessionPath = sessions[Math.min(idx, sessions.length - 1)].path;
    }
  }

  const sessionManager = new SessionManager(finalSessionPath);
  const resumed = !isNew && sessionManager.getMessages().length > 0;

  const model = gateway(flags.model);
  const sandbox = new LocalSandbox({ cwd });
  const { tools } = createAgentTools(sandbox, {
    tools: { Bash: { timeout: 30_000 } },
  });

  const skills = await discoverSkills({ cwd });
  if (skills.length > 0) {
    const skillsByName = Object.fromEntries(skills.map((s) => [s.name, s]));
    tools.Skill = createSkillTool(skillsByName);
  }

  const skillsXml = skills.length > 0 ? skillsToXml(skills) : "";

  const agent = new Agent({
    model,
    tools,
    system: [
      "You are a skilled coding agent with access to the local filesystem and shell.",
      `Work directory: ${cwd}`,
      "Use the available tools to complete the task.",
      skillsXml,
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxSteps: 10,
    sessionManager,
    compaction: {
      maxTokens: 200_000,
      keepRecentTokens: 20_000,
      reserveTokens: 16_384,
    },
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (resumed) {
    const ts = path.basename(finalSessionPath, ".jsonl");
    console.log(`Resumed session ${ts} (${sessionManager.getMessages().length} messages).`);
  }
  if (skills.length > 0) {
    console.log(`Skills: ${skills.map((s) => s.name).join(", ")}`);
  }
  console.log('Type your message, or "/exit" to quit.\n');

  const separator = "─".repeat(60);

  while (true) {
    const input = await rl.question("> ").catch(() => null);
    if (input === null || input.trim() === "/exit") break;
    if (!input.trim()) continue;

    console.log(separator);

    for await (const event of agent.stream(input)) {
      switch (event.type) {
        case "text-delta":
          process.stdout.write(event.delta);
          break;
        case "tool-call":
          console.log(`\n[tool] ${event.toolName}(${JSON.stringify(event.input).slice(0, 80)}...)`);
          break;
        case "done":
          console.log(
            `\n${separator}\nTokens: input=${event.usage.inputTokens} output=${event.usage.outputTokens}`,
          );
          break;
      }
    }

    console.log();
  }

  rl.close();
  console.log("Bye!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
