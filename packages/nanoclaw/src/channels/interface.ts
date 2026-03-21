import type { InboundMessage } from "../types.js";

/** A connected messaging channel that can send and receive messages. */
export interface Channel {
  readonly name: string;
  connect(): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
  ownsChat?(chatId: string): boolean;
  setTyping?(chatId: string, isTyping: boolean): Promise<void>;
}

/** Factory that creates a channel. Caller ensures required credentials are available. */
export type ChannelFactory = (opts: { onMessage: (msg: InboundMessage) => void }) => Channel;
