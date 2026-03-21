import type { Sandbox } from "@open-agent-sdk/core";

/** Inbound message from any channel, stored in SQLite. */
export interface InboundMessage {
  id: string;
  chatId: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: string;
  channel: string;
  isFromMe?: boolean;
}

/** Nanoclaw daemon configuration (output of config loading). */
export interface NanoclawConfig {
  /** Assistant display name */
  name: string;
  /** Telegram bot token (enables Telegram channel) */
  telegramBotToken?: string;
  /** AI model API key */
  apiKey: string;
  /** Model identifier (e.g. "anthropic/claude-sonnet-4-6") */
  model: string;
  /** Polling interval in ms (default: 2000) */
  pollInterval: number;
  /** Max agent steps per invocation (default: 20) */
  maxSteps: number;
  /** Data directory for SQLite DB and group workspaces */
  dataDir: string;
  /** Sandbox factory — creates a sandbox for a group workspace directory */
  createSandbox: (groupDir: string) => Sandbox;
}
