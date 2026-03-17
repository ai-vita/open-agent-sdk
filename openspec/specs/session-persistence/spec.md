# session-persistence Specification

## Purpose
TBD - created by archiving change adopt-edge-pi-patterns. Update Purpose after archive.
## Requirements
### Requirement: SessionManager stores messages as JSONL entries
The `SessionManager` SHALL persist conversation messages as newline-delimited JSON entries in a single file, where each entry contains a unique `id`, an optional `parentId`, a `type`, and a `timestamp`.

#### Scenario: Append a message
- **WHEN** `append({ role: "user", content: "hello" })` is called on a new session
- **THEN** a JSONL entry SHALL be written with `type: "message"`, a unique `id`, `parentId: null`, and the message payload

#### Scenario: Append sequential messages
- **WHEN** two messages are appended in order
- **THEN** the second entry's `parentId` SHALL equal the first entry's `id`

### Requirement: Read conversation by traversing from leaf to root
The `SessionManager` SHALL provide a `getMessages()` method that returns the conversation as an ordered array of `ModelMessage` by traversing parent pointers from the current leaf to the root.

#### Scenario: Linear conversation
- **WHEN** three messages have been appended sequentially
- **THEN** `getMessages()` SHALL return all three messages in append order

#### Scenario: Empty session
- **WHEN** no messages have been appended
- **THEN** `getMessages()` SHALL return an empty array

### Requirement: Branching support
The `SessionManager` SHALL support branching by allowing the leaf pointer to be moved to an earlier entry. A `branch-summary` entry SHALL be appended to capture the context of the abandoned branch.

#### Scenario: Branch from earlier point
- **WHEN** five messages exist and `branch(entry2.id, "Exploring different approach")` is called
- **THEN** the leaf pointer SHALL move to `entry2`
- **AND** a `branch-summary` entry SHALL be appended as a child of `entry2`
- **AND** `getMessages()` SHALL return only messages from root to `entry2` plus the branch summary

### Requirement: Compaction entries
The `SessionManager` SHALL support appending `compaction` entries that store a summary of compacted messages, replacing them in the conversation view.

#### Scenario: Append compaction
- **WHEN** `appendCompaction(summary, compactedEntryIds)` is called
- **THEN** a `compaction` entry SHALL be stored with the summary text
- **AND** subsequent `getMessages()` SHALL return the compaction summary in place of the compacted messages

### Requirement: File locking for concurrent access
The `SessionManager` SHALL use file locking to prevent concurrent writes from corrupting the JSONL file.

#### Scenario: Concurrent appends
- **WHEN** two `append()` calls execute simultaneously
- **THEN** both entries SHALL be written without corruption
- **AND** their parent-child relationships SHALL be consistent

### Requirement: Session initialization and file path
The `SessionManager` SHALL accept a file path at construction and create the file if it does not exist.

#### Scenario: New session file
- **WHEN** a `SessionManager` is created with path `/tmp/session.jsonl`
- **THEN** the file SHALL be created if it does not already exist
- **AND** subsequent operations SHALL read from and write to that file

#### Scenario: Resume existing session
- **WHEN** a `SessionManager` is created with a path to an existing JSONL file
- **THEN** it SHALL load the existing entries and set the leaf pointer to the last entry

