#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import path from "node:path";
import { gateway } from "ai";
import type { Channel } from "./channels/interface.js";
import { registerChannel } from "./channels/interface.js";
import { createTelegramChannel } from "./channels/telegram.js";
import { createTerminalChannel } from "./channels/terminal.js";
import { loadConfig } from "./config.js";
import { startLoop } from "./loop.js";
import { initDb, storeChatMetadata, storeMessage } from "./store/db.js";
import type { InboundMessage } from "./types.js";

const VERSION = "0.1.0";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`nanoclaw v${VERSION} — multi-channel AI assistant daemon

Usage: nanoclaw [options]

Options:
  --terminal    Force terminal mode (even if other channels are configured)
  --help, -h    Show this help
  --version, -v Show version`);
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  const forceTerminal = args.includes("--terminal");

  // 1. Load config
  const config = loadConfig();

  // 2. Ensure data directory exists
  mkdirSync(path.join(config.dataDir, "groups"), { recursive: true });

  // 3. Init database
  const db = initDb(config.dataDir);

  // 4. Register channel factories
  registerChannel("telegram", createTelegramChannel);
  registerChannel("terminal", createTerminalChannel);

  // 5. Connect channels
  const activeChannels: Channel[] = [];

  const onMessage = (msg: InboundMessage) => {
    storeMessage(db, msg);
    storeChatMetadata(db, msg.chatId, {
      channel: msg.channel,
      lastMessageAt: msg.timestamp,
    });
  };

  if (!forceTerminal) {
    // Try Telegram
    const telegram = createTelegramChannel({ onMessage });
    if (telegram) {
      await telegram.connect();
      activeChannels.push(telegram);
      console.log("Connected: Telegram");
    }
  }

  // Fall back to terminal if no channels connected or forced
  if (activeChannels.length === 0 || forceTerminal) {
    const terminal = createTerminalChannel({ onMessage });
    if (!terminal) throw new Error("Terminal channel failed to initialize");
    await terminal.connect();
    activeChannels.push(terminal);
    console.log("Connected: Terminal (dev mode)");
  }

  // 6. Start message loop
  const model = gateway(config.model);
  const loop = startLoop({ db, channels: activeChannels, config, model });
  console.log(`${config.name} is running (model: ${config.model}, poll: ${config.pollInterval}ms)`);

  // 7. Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    loop.stop();
    for (const ch of activeChannels) {
      await ch.disconnect();
    }
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
