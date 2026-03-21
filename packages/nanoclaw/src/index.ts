#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import path from "node:path";
import { gateway } from "ai";
import type { Channel } from "./channels/interface.js";
import { createTelegramChannel } from "./channels/telegram.js";
import { createTerminalChannel } from "./channels/terminal.js";
import { loadConfig } from "./config.js";
import { startLoop } from "./loop.js";
import { initDb, storeMessage } from "./store/db.js";
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

  // 4. Connect channels
  const activeChannels: Channel[] = [];

  const onMessage = (msg: InboundMessage) => {
    storeMessage(db, msg);
  };

  if (!forceTerminal && config.telegramBotToken) {
    const telegram = createTelegramChannel({ token: config.telegramBotToken, onMessage });
    await telegram.connect();
    activeChannels.push(telegram);
    console.log("Connected: Telegram");
  }

  // Fall back to terminal if no channels connected or forced
  const useTerminal = activeChannels.length === 0 || forceTerminal;
  let terminal: Channel | null = null;
  if (useTerminal) {
    terminal = createTerminalChannel({ onMessage });
    activeChannels.push(terminal);
    console.log("Connected: Terminal (dev mode)");
  }

  // 6. Start message loop
  const model = gateway(config.model);
  const loop = startLoop({ db, channels: activeChannels, config, model });
  console.log(`${config.name} is running (model: ${config.model}, poll: ${config.pollInterval}ms)`);

  // Connect terminal after all startup logs so the prompt appears last
  if (terminal) {
    await terminal.connect();
  }

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
