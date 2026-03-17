/**
 * Example: Multi-Turn Agent
 *
 * Demonstrates the Agent class for stateful multi-turn conversations with:
 *   - Automatic conversation state management
 *   - Auto-compaction when context gets large
 *   - Message steering for injecting guidance
 *   - Streaming support
 *
 * Run:
 *   pnpm multi-turn
 */

import "dotenv/config";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: true });

import { Agent } from "@open-agent-sdk/core";
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createAgentTools } from "@open-agent-sdk/tools";
import { gateway } from "ai";

async function main() {
  const model = gateway("anthropic/claude-sonnet-4.6");
  const cwd = process.cwd();
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
    compaction: {
      maxTokens: 200_000,
      keepRecentTokens: 20_000,
      reserveTokens: 16_384,
    },
  });

  // ── Turn 1: Initial task ──────────────────────────────────────────────────
  console.log(`Turn 1: Listing files\n${"─".repeat(60)}`);

  for await (const event of agent.stream(
    "List the files in the current directory and summarize what you see.",
  )) {
    switch (event.type) {
      case "text-delta":
        process.stdout.write(event.delta);
        break;
      case "tool-call":
        console.log(`\n[tool] ${event.toolName}`);
        break;
      case "done":
        console.log(
          `\n${"─".repeat(60)}\nTokens: input=${event.usage.inputTokens} output=${event.usage.outputTokens}`,
        );
        break;
    }
  }

  // ── Turn 2: Follow-up using conversation context ──────────────────────────
  console.log(`\n\nTurn 2: Follow-up question\n${"─".repeat(60)}`);

  for await (const event of agent.stream(
    "Which of those files is the main entry point? Read it and explain what it does.",
  )) {
    switch (event.type) {
      case "text-delta":
        process.stdout.write(event.delta);
        break;
      case "done":
        console.log(
          `\n${"─".repeat(60)}\nTokens: input=${event.usage.inputTokens} output=${event.usage.outputTokens}`,
        );
        break;
    }
  }

  // ── Turn 3: Steering ──────────────────────────────────────────────────────
  console.log(`\n\nTurn 3: Steered review\n${"─".repeat(60)}`);

  agent.steer({ role: "user", content: "Focus specifically on error handling patterns." });

  for await (const event of agent.stream("Review the code you just read.")) {
    switch (event.type) {
      case "text-delta":
        process.stdout.write(event.delta);
        break;
      case "done":
        console.log(
          `\n${"─".repeat(60)}\nTokens: input=${event.usage.inputTokens} output=${event.usage.outputTokens}`,
        );
        break;
    }
  }

  console.log(`\n\nConversation: ${agent.getMessages().length} messages total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
