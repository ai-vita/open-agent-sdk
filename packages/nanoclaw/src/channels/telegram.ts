import { Bot } from "grammy";
import type { InboundMessage } from "../types.js";
import type { Channel } from "./interface.js";

/** Creates a Telegram channel via grammY. Caller must ensure token is available. */
export function createTelegramChannel(opts: {
  token: string;
  onMessage: (msg: InboundMessage) => void;
}): Channel {
  const { token, onMessage } = opts;
  const bot = new Bot(token);

  bot.on("message:text", (ctx) => {
    const msg: InboundMessage = {
      id: String(ctx.message.message_id),
      chatId: String(ctx.chat.id),
      sender: String(ctx.from.id),
      senderName: ctx.from.first_name,
      content: ctx.message.text,
      timestamp: new Date(ctx.message.date * 1000).toISOString(),
      channel: "telegram",
    };
    onMessage(msg);
  });

  return {
    name: "telegram",
    async connect() {
      bot.start();
    },
    async sendMessage(chatId: string, text: string) {
      await bot.api.sendMessage(chatId, text);
    },
    async disconnect() {
      await bot.stop();
    },
    ownsChat(chatId: string) {
      // Telegram chat IDs are numeric
      return /^-?\d+$/.test(chatId);
    },
    async setTyping(chatId: string) {
      await bot.api.sendChatAction(chatId, "typing");
    },
  };
}
