# caching Specification

## Purpose
TBD - created by archiving change create-open-agent-sdk. Update Purpose after archive.
## Requirements
### Requirement: Pluggable cache store interface
The core package SHALL define a `CacheStore` interface with `get`, `set`, `delete`, `clear`, and optional `size` methods, supporting both synchronous and asynchronous implementations.

#### Scenario: Implement an LRU cache store
- **WHEN** a consumer creates an in-memory LRU store implementing `CacheStore`
- **THEN** the store SHALL be usable with the `cached()` wrapper

#### Scenario: Implement a Redis cache store
- **WHEN** a consumer creates an async Redis store implementing `CacheStore`
- **THEN** the store SHALL be usable with the `cached()` wrapper via async method support

### Requirement: Cached tool wrapper
The core package SHALL export a `cached(tool, toolName, options)` function that wraps any Vercel AI SDK tool with caching behavior.

#### Scenario: Cache a tool result
- **WHEN** a cached Read tool is called twice with the same input
- **THEN** the second call SHALL return the cached result without re-executing the tool

#### Scenario: Only cache successful results
- **WHEN** a tool execution returns an error result
- **THEN** the error SHALL NOT be cached, and subsequent calls SHALL re-execute the tool

#### Scenario: TTL-based expiration
- **WHEN** a cached result is older than the configured TTL
- **THEN** the next call SHALL re-execute the tool and update the cache

### Requirement: LRU cache store implementation
The core package SHALL provide a built-in `LRUCacheStore` with configurable capacity and O(1) access.

#### Scenario: Evict oldest entries
- **WHEN** the cache reaches its capacity limit
- **THEN** the least recently used entry SHALL be evicted to make room

### Requirement: Per-tool cache configuration
The `createAgentTools` convenience function SHALL accept a `cache` option to enable caching with per-tool control.

#### Scenario: Enable caching with defaults
- **WHEN** `createAgentTools(sandbox, { cache: true })` is called
- **THEN** read-only tools (Read, Glob, Grep) SHALL be cached with default TTL

#### Scenario: Per-tool cache override
- **WHEN** `createAgentTools(sandbox, { cache: { Read: true, Grep: false } })` is called
- **THEN** Read SHALL be cached and Grep SHALL NOT be cached

### Requirement: Cache statistics
Cached tools SHALL expose `getStats()` and `clearCache()` methods for monitoring and management.

#### Scenario: Query cache stats
- **WHEN** `cachedTool.getStats()` is called
- **THEN** the result SHALL include `hits`, `misses`, `hitRate`, and `size`

