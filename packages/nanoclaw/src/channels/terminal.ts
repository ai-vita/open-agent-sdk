import * as readline from "node:readline";
import type { InboundMessage } from "../types.js";
import type { Channel, ChannelFactory } from "./interface.js";

const TERMINAL_CHAT_ID = "terminal";

/** Creates a terminal channel for dev mode. Uses stdin/stdout. */
export const createTerminalChannel: ChannelFactory = ({ onMessage }): Channel => {
  let rl: readline.Interface | null = null;

  return {
    name: "terminal",
    async connect() {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "> ",
      });

      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const msg: InboundMessage = {
          id: `terminal-${Date.now()}`,
          chatId: TERMINAL_CHAT_ID,
          sender: "user",
          senderName: "User",
          content: trimmed,
          timestamp: new Date().toISOString(),
          channel: "terminal",
        };
        onMessage(msg);
      });

      rl.prompt();
    },
    async sendMessage(_chatId: string, text: string) {
      process.stdout.write(`${text}\n`);
      rl?.prompt();
    },
    async disconnect() {
      rl?.close();
      rl = null;
    },
    ownsChat(chatId: string) {
      return chatId === TERMINAL_CHAT_ID;
    },
  };
};
