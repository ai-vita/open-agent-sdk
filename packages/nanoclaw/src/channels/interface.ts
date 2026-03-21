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

/** Factory that creates a channel, or returns null if credentials not configured. */
export type ChannelFactory = (opts: { onMessage: (msg: InboundMessage) => void }) => Channel | null;

const registry = new Map<string, ChannelFactory>();

/** Register a channel factory by name. */
export function registerChannel(name: string, factory: ChannelFactory): void {
  registry.set(name, factory);
}

/** Get a registered channel factory by name. */
export function getChannelFactory(name: string): ChannelFactory | undefined {
  return registry.get(name);
}

/** Get all registered channel names. */
export function getRegisteredChannelNames(): string[] {
  return [...registry.keys()];
}

/** Clear all registrations (for testing). */
export function clearChannelRegistry(): void {
  registry.clear();
}
