import path from "node:path";
import type { LanguageModel } from "ai";
import type Database from "better-sqlite3";
import type { Channel } from "./channels/interface.js";
import { formatMessages, stripInternalTags } from "./format.js";
import { runGroupAgent } from "./runner.js";
import {
  getMessagesSince,
  getNewMessages,
  getRouterState,
  setRouterState,
  storeChatMetadata,
} from "./store/db.js";
import type { NanoclawConfig } from "./types.js";

const CURSOR_KEY = "last_timestamp";

function agentCursorKey(chatId: string): string {
  return `last_agent_timestamp:${chatId}`;
}

export interface LoopContext {
  db: Database.Database;
  channels: Channel[];
  config: NanoclawConfig;
  model: LanguageModel;
}

/** Find the channel that owns a chat ID. */
function findChannel(
  channels: Channel[],
  chatId: string,
  db: Database.Database,
): Channel | undefined {
  // Check ownsChat first
  for (const ch of channels) {
    if (ch.ownsChat?.(chatId)) return ch;
  }
  // Fall back to chat metadata
  const row = db.prepare("SELECT channel FROM chats WHERE id = ?").get(chatId) as
    | { channel: string }
    | undefined;
  if (row?.channel) {
    return channels.find((ch) => ch.name === row.channel);
  }
  // Default to first channel
  return channels[0];
}

/** Process messages for a single chat. */
async function processChat(chatId: string, ctx: LoopContext): Promise<void> {
  const agentCursor = getRouterState(ctx.db, agentCursorKey(chatId)) || "1970-01-01T00:00:00.000Z";
  const messages = getMessagesSince(ctx.db, chatId, agentCursor);
  if (messages.length === 0) return;

  // Look up chat name
  const chatRow = ctx.db.prepare("SELECT name FROM chats WHERE id = ?").get(chatId) as
    | { name: string | null }
    | undefined;
  const chatName = chatRow?.name || chatId;

  const prompt = formatMessages(messages, chatName);
  if (!prompt) return;

  const groupDir = path.resolve(ctx.config.dataDir, "groups", chatId);
  const sandbox = ctx.config.createSandbox(groupDir);
  const channel = findChannel(ctx.channels, chatId, ctx.db);

  let hasOutput = false;
  const chunks: string[] = [];

  try {
    // Set typing indicator
    if (channel?.setTyping) {
      await channel.setTyping(chatId, true);
    }

    for await (const chunk of runGroupAgent({
      prompt,
      groupId: chatId,
      sandbox,
      model: ctx.model,
      db: ctx.db,
      assistantName: ctx.config.name,
      maxSteps: ctx.config.maxSteps,
    })) {
      chunks.push(chunk);
      hasOutput = true;
    }

    // Send the response
    if (channel && chunks.length > 0) {
      const fullText = stripInternalTags(chunks.join(""));
      if (fullText) {
        await channel.sendMessage(chatId, fullText);
      }
    }

    // Advance agent cursor
    const lastTimestamp = messages[messages.length - 1].timestamp;
    setRouterState(ctx.db, agentCursorKey(chatId), lastTimestamp);
  } catch (error) {
    if (!hasOutput) {
      // No output sent — safe to retry next poll (don't advance cursor)
      console.error(`Error processing chat ${chatId} (will retry):`, error);
    } else {
      // Output was partially sent — advance cursor to prevent duplicates
      const lastTimestamp = messages[messages.length - 1].timestamp;
      setRouterState(ctx.db, agentCursorKey(chatId), lastTimestamp);
      console.error(`Error processing chat ${chatId} (output sent, advancing cursor):`, error);
    }
  } finally {
    if (sandbox.destroy) {
      await sandbox.destroy();
    }
  }
}

/** Single poll iteration. */
async function poll(ctx: LoopContext): Promise<void> {
  const lastTimestamp = getRouterState(ctx.db, CURSOR_KEY) || "1970-01-01T00:00:00.000Z";

  // Get all new messages across all chats
  const messages = getNewMessages(ctx.db, [], lastTimestamp);
  if (messages.length === 0) return;

  // Advance global cursor immediately
  const newCursor = messages[messages.length - 1].timestamp;
  setRouterState(ctx.db, CURSOR_KEY, newCursor);

  // Group by chatId
  const byChatId = new Map<string, boolean>();
  for (const msg of messages) {
    byChatId.set(msg.chatId, true);
    // Update chat metadata
    storeChatMetadata(ctx.db, msg.chatId, {
      channel: msg.channel,
      lastMessageAt: msg.timestamp,
    });
  }

  // Process each chat sequentially (MVP — Layer 2 adds concurrency)
  for (const chatId of byChatId.keys()) {
    await processChat(chatId, ctx);
  }
}

/** Start the message polling loop. Returns a handle to stop it. */
export function startLoop(ctx: LoopContext): { stop: () => void } {
  let running = true;

  const tick = async () => {
    if (!running) return;
    try {
      await poll(ctx);
    } catch (error) {
      console.error("Poll error:", error);
    }
    if (running) {
      setTimeout(tick, ctx.config.pollInterval);
    }
  };

  // Start first poll
  setTimeout(tick, 0);

  return {
    stop() {
      running = false;
    },
  };
}
