import { Bot } from "grammy";
import type { InboundMessage } from "../types.js";
import type { Channel, ChannelFactory } from "./interface.js";

/** Creates a Telegram channel via grammY. Returns null if TELEGRAM_BOT_TOKEN not set. */
export const createTelegramChannel: ChannelFactory = ({ onMessage }): Channel | null => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

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
};
