import type { ModelMessage } from "ai";
import type { SessionEntry } from "./types.js";

/**
 * Minimal contract the Agent class needs for session persistence.
 * Supports append, replay with compaction substitution, branching, and inspection.
 */
export interface SessionStore {
  /** Persist a message, return entry ID. */
  append(message: ModelMessage): string;

  /** Ordered conversation with compaction substitution. */
  getMessages(): ModelMessage[];

  /** Record a compaction that summarizes older messages. */
  appendCompaction(summary: string, compactedEntryIds: string[]): string;

  /** Branch from an earlier entry. Throws if entryId not found. */
  branch(entryId: string, reason: string): string;

  /** All entries along current path (root-first). */
  getPathEntries(): SessionEntry[];

  /** Current leaf entry ID. */
  getLeafId(): string | null;
}
