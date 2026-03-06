import type { Tool, ToolSet } from "ai";

/**
 * Re-export AI SDK tool types for convenience.
 */
export type { Tool, ToolSet };

/**
 * SDK tool options picked from the AI SDK Tool type.
 */
export type SDKToolOptions = Partial<
  Pick<Tool<Record<string, unknown>, unknown>, "strict" | "needsApproval" | "providerOptions">
>;

/**
 * Base configuration for sandbox-based tools.
 */
export type ToolConfig = {
  /** Execution timeout in milliseconds */
  timeout?: number;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Maximum output length in characters */
  maxOutputLength?: number;
  /** Restrict operations to these path prefixes */
  allowedPaths?: string[];
  /** Block commands containing these substrings */
  blockedCommands?: string[];
} & SDKToolOptions;

/**
 * Discriminated union for tool success/error results.
 */
export type ToolResult<T> = T | { error: string };
