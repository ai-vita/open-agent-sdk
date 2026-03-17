import type { ModelMessage } from "ai";

export interface SessionEntryBase {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
}

/** A message entry that stores a native ModelMessage */
export interface MessageEntry extends SessionEntryBase {
  type: "message";
  message: ModelMessage;
}

/** Compaction entry — summary of compacted messages */
export interface CompactionEntry extends SessionEntryBase {
  type: "compaction";
  summary: string;
  compactedEntryIds: string[];
}

/** Branch summary entry — captures context of an abandoned branch */
export interface BranchSummaryEntry extends SessionEntryBase {
  type: "branch_summary";
  reason: string;
}

/** Union of all session entry types */
export type SessionEntry = MessageEntry | CompactionEntry | BranchSummaryEntry;
