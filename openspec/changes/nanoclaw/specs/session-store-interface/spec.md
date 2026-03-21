## SessionStore Interface Spec

### Interface Contract

`SessionStore` defines the minimal contract the `Agent` class needs for session persistence. It must support:

1. **Append** — add a message, return a unique entry ID
2. **Replay** — reconstruct the conversation from the current leaf, handling compaction substitution
3. **Compact** — record a compaction that summarizes older messages
4. **Branch** — fork from an earlier point in the conversation
5. **Inspect** — get path entries and leaf ID for history rendering

### Methods

| Method | Signature | Purpose |
|---|---|---|
| `append` | `(message: ModelMessage) => string` | Persist a message, return entry ID |
| `getMessages` | `() => ModelMessage[]` | Ordered conversation with compaction substitution |
| `appendCompaction` | `(summary: string, compactedEntryIds: string[]) => string` | Record compaction |
| `branch` | `(entryId: string, reason: string) => string` | Branch from earlier entry |
| `getPathEntries` | `() => SessionEntry[]` | All entries along current path (root-first) |
| `getLeafId` | `() => string \| null` | Current leaf entry ID |

### Invariants

- `append()` must set the new entry as the leaf
- `getMessages()` must exclude entries referenced by `compactedEntryIds` in any compaction on the path
- `getMessages()` must substitute compaction entries with a summary user message + acknowledgment assistant message
- `branch()` must throw if `entryId` is not found
- Entry IDs must be unique across the lifetime of the store
- `getPathEntries()` returns entries in root-to-leaf order

### Existing Implementation

`SessionManager` (JSONL-backed) already satisfies all these invariants. Extracting the interface is a type-level change only — no behavior modifications.

### SqliteSessionStore Implementation (nanoclaw)

Backed by a `session_entries` table with `group_id` partitioning. Same tree-traversal logic as `SessionManager`:

- **Load on construction**: query all entries for the group, build `byId` map, find leaf
- **append/appendCompaction/branch**: insert row + update in-memory state
- **getMessages/getPathEntries**: traverse in-memory tree (same algorithm as SessionManager)

The SQLite store is a persistence backend swap, not a behavior change. Both implementations must pass the same logical test suite.
