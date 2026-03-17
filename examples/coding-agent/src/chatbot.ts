/**
 * Example: Interactive Chatbot
 *
 * A terminal chatbot powered by Open Agent SDK with:
 *   - Session persistence across runs (JSONL file)
 *   - Auto-compaction when context gets large
 *   - Streaming responses
 *
 * Run:
 *   pnpm chatbot              # resume or start a session
 *   pnpm chatbot --new        # start a fresh session
 */

import "dotenv/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { Agent, SessionManager } from "@open-agent-sdk/core";
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createAgentTools } from "@open-agent-sdk/tools";
import { gateway } from "ai";

const SESSION_FILE = ".session.jsonl";

async function main() {
  const cwd = process.cwd();
  const sessionPath = path.join(cwd, SESSION_FILE);

  // --new flag resets the session
  if (process.argv.includes("--new") && existsSync(sessionPath)) {
    unlinkSync(sessionPath);
    console.log("Session cleared.\n");
  }

  const sessionManager = new SessionManager(sessionPath);
  const resumed = sessionManager.getMessages().length > 0;

  const model = gateway("anthropic/claude-sonnet-4.6");
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
  console.log('Type your message, or "exit" to quit.\n');

  const separator = "─".repeat(60);

  while (true) {
    const input = await rl.question(">").catch(() => null);
    if (input === null || input.trim() === "exit") break;
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
