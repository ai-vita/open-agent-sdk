/**
 * Example: Coding Agent
 *
 * Demonstrates how to wire together:
 *   - @open-agent-sdk/sandbox-local  — local shell + filesystem sandbox
 *   - @open-agent-sdk/tools          — standard coding tools (Bash, Read, Write, Edit, Glob, Grep)
 *   - @open-agent-sdk/skills         — on-demand skill activation
 *   - @open-agent-sdk/provider-anthropic — Anthropic prompt-caching middleware
 *   - @open-agent-sdk/core           — runAgent() agent loop + stop conditions
 *
 * Run:
 *   ANTHROPIC_API_KEY=... pnpm start
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { wrapLanguageModel } from "ai";
import { runAgent, stepCountIs } from "@open-agent-sdk/core";
import { createLocalSandbox } from "@open-agent-sdk/sandbox-local";
import { createAgentTools } from "@open-agent-sdk/tools";
import { discoverSkills, skillsToXml } from "@open-agent-sdk/skills";
import { anthropicPromptCacheMiddleware } from "@open-agent-sdk/provider-anthropic";

async function main() {
  // ── 1. Model ────────────────────────────────────────────────────────────────
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Wrap with Anthropic prompt-caching middleware to reduce costs on repeated runs
  const model = wrapLanguageModel({
    model: anthropic("claude-sonnet-4-5"),
    middleware: anthropicPromptCacheMiddleware,
  });

  // ── 2. Sandbox ──────────────────────────────────────────────────────────────
  // Local sandbox: commands run on the host machine in a temp directory
  const cwd = process.cwd();
  const sandbox = createLocalSandbox({ cwd });

  // ── 3. Tools ────────────────────────────────────────────────────────────────
  const { tools } = createAgentTools(sandbox, {
    tools: { Bash: { timeout: 30_000 } },
  });

  // ── 4. Skills ───────────────────────────────────────────────────────────────
  // Discover SKILL.md files from the default ~/.claude/skills directory (if any)
  const skills = await discoverSkills();
  const skillsXml = skills.length > 0 ? skillsToXml(skills) : "";

  // ── 5. System prompt ────────────────────────────────────────────────────────
  const system = [
    "You are a skilled coding agent with access to the local filesystem and shell.",
    "Work directory: " + cwd,
    "Use the available tools to complete the task.",
    skillsXml,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ── 6. Run the agent ────────────────────────────────────────────────────────
  const task = process.argv[2] ?? "List the files in the current directory and summarize what you see.";
  console.log(`\nTask: ${task}\n${"─".repeat(60)}`);

  for await (const event of runAgent({
    model,
    tools,
    system,
    messages: task,
    stopWhen: stepCountIs(10),
    stream: true,
  })) {
    switch (event.type) {
      case "text-delta":
        process.stdout.write(event.delta);
        break;
      case "tool-call":
        console.log(`\n[tool] ${event.toolName}(${JSON.stringify(event.input).slice(0, 80)}...)`);
        break;
      case "tool-result":
        console.log(`[result] exit=${(event.output as { exitCode?: number }).exitCode ?? "ok"}`);
        break;
      case "error":
        console.error(`\n[error] ${event.error}`);
        break;
      case "done":
        console.log(`\n${"─".repeat(60)}\nDone. Tokens: input=${event.usage.inputTokens} output=${event.usage.outputTokens}`);
        break;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
