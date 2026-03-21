import { Agent, type Sandbox } from "@open-agent-sdk/core";
import { createAgentTools } from "@open-agent-sdk/tools";
import type { LanguageModel } from "ai";
import type Database from "better-sqlite3";
import { SqliteSessionStore } from "./store/session-store.js";

export interface RunGroupAgentOptions {
  prompt: string;
  groupId: string;
  sandbox: Sandbox;
  model: LanguageModel;
  db: Database.Database;
  assistantName: string;
  maxSteps: number;
}

/** Load AGENTS.md memory from a group's sandbox, if it exists. */
async function loadGroupMemory(sandbox: Sandbox): Promise<string> {
  try {
    return await sandbox.readFile("AGENTS.md");
  } catch {
    return "";
  }
}

/** Build the system prompt for a group agent. */
function buildSystemPrompt(assistantName: string, groupId: string, memory: string): string {
  const parts = [
    `You are ${assistantName}, a helpful AI assistant.`,
    `You are chatting in group: ${groupId}.`,
    "",
    "You have access to tools for reading files, writing files, running bash commands, and more.",
    "Keep your responses helpful, concise, and friendly.",
  ];

  if (memory) {
    parts.push("", "## Memory", memory);
  }

  return parts.join("\n");
}

/**
 * Run the agent for a group. Yields text chunks as they are produced.
 * Creates a fresh Agent per invocation; SqliteSessionStore handles continuity.
 */
export async function* runGroupAgent(opts: RunGroupAgentOptions): AsyncGenerator<string> {
  const sessionStore = new SqliteSessionStore(opts.db, opts.groupId);
  const { tools } = createAgentTools(opts.sandbox);
  const memory = await loadGroupMemory(opts.sandbox);

  const agent = new Agent({
    model: opts.model,
    tools,
    system: buildSystemPrompt(opts.assistantName, opts.groupId, memory),
    sessionManager: sessionStore,
    maxSteps: opts.maxSteps,
    compaction: {
      maxTokens: 200_000,
      keepRecentTokens: 20_000,
      reserveTokens: 16_384,
    },
  });

  for await (const event of agent.stream(opts.prompt)) {
    if (event.type === "text-delta") {
      yield event.delta;
    }
  }
}
