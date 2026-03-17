/**
 * oa — Open Agent CLI
 *
 * A standalone interactive coding agent powered by Open Agent SDK.
 *
 * Usage:
 *   oa              # start or resume a session in the current directory
 *   oa --new        # start a fresh session
 *   oa --model X    # use a specific model (default: anthropic/claude-sonnet-4.6)
 *   oa --help       # show help
 *   oa --version    # show version
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

import { Agent, SessionManager } from "@open-agent-sdk/core";
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createAgentTools } from "@open-agent-sdk/tools";
import { gateway } from "ai";
import dotenv from "dotenv";

const SESSION_FILE = ".session.jsonl";

function loadEnv(cwd: string) {
  dotenv.config({ path: path.join(cwd, ".env") });
  dotenv.config({ path: path.join(cwd, ".env.local"), override: true });
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
  --new          Start a fresh session (discard previous)
  --model <id>   Model to use (default: anthropic/claude-sonnet-4.6)
  --help, -h     Show this help message
  --version, -v  Show version

Environment:
  AI_GATEWAY_API_KEY   API key for the AI gateway (can be set in .env.local)

The agent runs in the current working directory with access to
filesystem and shell tools. Sessions are persisted to .session.jsonl.
`;

export function parseCliArgs(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
      new: { type: "boolean", default: false },
      model: { type: "string", default: "anthropic/claude-sonnet-4.6" },
    },
    strict: true,
    allowPositionals: false,
  });
  return values;
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
  loadEnv(cwd);

  const sessionPath = path.join(cwd, SESSION_FILE);

  if (flags.new && existsSync(sessionPath)) {
    unlinkSync(sessionPath);
    console.log("Session cleared.\n");
  }

  const sessionManager = new SessionManager(sessionPath);
  const resumed = sessionManager.getMessages().length > 0;

  const model = gateway(flags.model!);
  const sandbox = new LocalSandbox({ cwd });
  const { tools } = createAgentTools(sandbox, {
    tools: { Bash: { timeout: 30_000 } },
  });

  const agent = new Agent({
    model,
    tools,
    system: [
      "You are a skilled coding agent with access to the local filesystem and shell.",
      `Work directory: ${cwd}`,
      "Use the available tools to complete the task.",
    ].join("\n\n"),
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
    console.log(`Resumed session (${sessionManager.getMessages().length} messages).`);
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
