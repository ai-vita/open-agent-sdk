import { randomUUID } from "node:crypto";
import type {
  BranchSummaryEntry,
  CompactionEntry,
  MessageEntry,
  SessionEntry,
  SessionStore,
} from "@open-agent-sdk/core";
import type { ModelMessage } from "ai";
import type Database from "better-sqlite3";

/**
 * SQLite-backed SessionStore. Same tree-traversal logic as SessionManager,
 * but reads/writes go to the `session_entries` table partitioned by `group_id`.
 */
export class SqliteSessionStore implements SessionStore {
  private entries: SessionEntry[] = [];
  private byId = new Map<string, SessionEntry>();
  private leafId: string | null = null;

  constructor(
    private db: Database.Database,
    private groupId: string,
  ) {
    this.load();
  }

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

  getMessages(): ModelMessage[] {
    if (!this.leafId) return [];

    const pathEntries: SessionEntry[] = [];
    let currentId: string | null = this.leafId;
    while (currentId) {
      const entry = this.byId.get(currentId);
      if (!entry) break;
      pathEntries.unshift(entry);
      currentId = entry.parentId;
    }

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

  getPathEntries(): SessionEntry[] {
    if (!this.leafId) return [];
    const result: SessionEntry[] = [];
    let currentId: string | null = this.leafId;
    while (currentId) {
      const entry = this.byId.get(currentId);
      if (!entry) break;
      result.push(entry);
      currentId = entry.parentId;
    }
    return result.reverse();
  }

  getLeafId(): string | null {
    return this.leafId;
  }

  private addEntry(entry: SessionEntry): void {
    this.entries.push(entry);
    this.byId.set(entry.id, entry);
  }

  private load(): void {
    const rows = this.db
      .prepare(
        "SELECT id, parent_id, type, data, created_at FROM session_entries WHERE group_id = ? ORDER BY created_at ASC",
      )
      .all(this.groupId) as Array<{
      id: string;
      parent_id: string | null;
      type: string;
      data: string;
      created_at: string;
    }>;

    for (const row of rows) {
      const parsed = JSON.parse(row.data);
      const entry: SessionEntry = {
        ...parsed,
        id: row.id,
        parentId: row.parent_id,
        type: row.type,
        timestamp: row.created_at,
      };
      this.addEntry(entry);
      this.leafId = entry.id;
    }
  }

  private persistEntry(entry: SessionEntry): void {
    const { id, parentId, type, timestamp, ...rest } = entry;
    this.db
      .prepare(
        "INSERT INTO session_entries (id, group_id, parent_id, type, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, this.groupId, parentId, type, JSON.stringify(rest), timestamp);
  }
}
