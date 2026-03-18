import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ModelMessage } from "ai";
import type { BranchSummaryEntry, CompactionEntry, MessageEntry, SessionEntry } from "./types.js";

/**
 * JSONL-based session manager with tree structure for conversation persistence.
 * Supports linear replay, branching, and compaction.
 */
export class SessionManager {
  private entries: SessionEntry[] = [];
  private byId = new Map<string, SessionEntry>();
  private leafId: string | null = null;
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.load();
  }

  /** Append a message to the session. */
  append(message: ModelMessage): string {
    const entry: MessageEntry = {
      type: "message",
      id: randomUUID(),
      parentId: this.leafId,
      timestamp: new Date().toISOString(),
      message,
    };
    this.addEntry(entry);
    this.leafId = entry.id;
    this.persistEntry(entry);
    return entry.id;
  }

  /** Get the ordered conversation messages by traversing from leaf to root. */
  getMessages(): ModelMessage[] {
    if (!this.leafId) return [];

    // Walk from leaf to root collecting the path
    const pathEntries: SessionEntry[] = [];
    let currentId: string | null = this.leafId;
    while (currentId) {
      const entry = this.byId.get(currentId);
      if (!entry) break;
      pathEntries.unshift(entry);
      currentId = entry.parentId;
    }

    // Build messages, substituting compaction summaries
    const compactedIds = new Set<string>();
    for (const entry of pathEntries) {
      if (entry.type === "compaction") {
        for (const id of entry.compactedEntryIds) {
          compactedIds.add(id);
        }
      }
    }

    const messages: ModelMessage[] = [];
    for (const entry of pathEntries) {
      if (compactedIds.has(entry.id)) continue;

      if (entry.type === "message") {
        messages.push(entry.message);
      } else if (entry.type === "compaction") {
        messages.push({
          role: "user",
          content: `[Previous conversation summary]\n${entry.summary}`,
        });
        messages.push({
          role: "assistant",
          content:
            "I have reviewed the summary of our previous conversation and will continue from there.",
        });
      } else if (entry.type === "branch_summary") {
        messages.push({
          role: "user",
          content: `[Branch point: ${entry.reason}]`,
        });
      }
    }

    return messages;
  }

  /** Branch from an earlier entry, abandoning subsequent messages. */
  branch(entryId: string, reason: string): string {
    if (!this.byId.has(entryId)) {
      throw new Error(`Entry ${entryId} not found`);
    }

    this.leafId = entryId;

    const branchEntry: BranchSummaryEntry = {
      type: "branch_summary",
      id: randomUUID(),
      parentId: entryId,
      timestamp: new Date().toISOString(),
      reason,
    };
    this.addEntry(branchEntry);
    this.leafId = branchEntry.id;
    this.persistEntry(branchEntry);
    return branchEntry.id;
  }

  /** Append a compaction entry that replaces older messages with a summary. */
  appendCompaction(summary: string, compactedEntryIds: string[]): string {
    const entry: CompactionEntry = {
      type: "compaction",
      id: randomUUID(),
      parentId: this.leafId,
      timestamp: new Date().toISOString(),
      summary,
      compactedEntryIds,
    };
    this.addEntry(entry);
    this.leafId = entry.id;
    this.persistEntry(entry);
    return entry.id;
  }

  /** Get the current leaf entry ID. */
  getLeafId(): string | null {
    return this.leafId;
  }

  /** Get all entries in the session. */
  getEntries(): readonly SessionEntry[] {
    return this.entries;
  }

  private addEntry(entry: SessionEntry): void {
    this.entries.push(entry);
    this.byId.set(entry.id, entry);
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;

    const content = readFileSync(this.filePath, "utf-8").trim();
    if (!content) return;

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as SessionEntry;
      this.addEntry(entry);
      this.leafId = entry.id;
    }
  }

  private persistEntry(entry: SessionEntry): void {
    if (!existsSync(this.filePath)) {
      mkdirSync(path.dirname(this.filePath), { recursive: true });
    }
    appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, "utf-8");
  }
}
