import { createHash } from "node:crypto";
import type { Tool } from "ai";

// ---------------------------------------------------------------------------
// Cache store interface
// ---------------------------------------------------------------------------

/**
 * A single cache entry with result and timestamp for TTL checks.
 */
export interface CacheEntry<T = unknown> {
  result: T;
  timestamp: number;
}

/**
 * Pluggable cache store interface. Supports both sync and async implementations.
 */
export interface CacheStore<T = unknown> {
  get(key: string): CacheEntry<T> | undefined | Promise<CacheEntry<T> | undefined>;
  set(key: string, entry: CacheEntry<T>): void | Promise<void>;
  delete(key: string): void | Promise<void>;
  clear(): void | Promise<void>;
  /** Optional: return current number of entries */
  size?(): number | Promise<number>;
}

/**
 * Options for the cached() wrapper.
 */
export interface CacheOptions {
  /** TTL in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Custom cache store (default: LRUCacheStore) */
  store?: CacheStore;
  /** Custom key generator */
  keyGenerator?: (toolName: string, params: unknown) => string;
  /** Enable debug logging */
  debug?: boolean;
  /** Called on cache hit */
  onHit?: (toolName: string, key: string) => void;
  /** Called on cache miss */
  onMiss?: (toolName: string, key: string) => void;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}

// ---------------------------------------------------------------------------
// LRU cache store
// ---------------------------------------------------------------------------

/**
 * In-memory LRU cache with O(1) access via Map insertion ordering.
 */
export class LRUCacheStore<T = unknown> implements CacheStore<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry;
  }

  set(key: string, entry: CacheEntry<T>): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, entry);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ---------------------------------------------------------------------------
// cached() wrapper
// ---------------------------------------------------------------------------

function defaultKeyGenerator(toolName: string, params: unknown): string {
  const sortedKeys =
    params && typeof params === "object"
      ? Object.keys(params as object).sort()
      : undefined;
  const serialized = JSON.stringify(params, sortedKeys);
  const hash = createHash("sha256").update(serialized).digest("hex").slice(0, 16);
  return `${toolName}:${hash}`;
}

/**
 * Extended tool with cache management methods.
 */
export type CachedTool<T extends Tool = Tool> = T & {
  getStats(): Promise<CacheStats>;
  clearCache(key?: string): Promise<void>;
};

/**
 * Wraps a Vercel AI SDK tool with caching.
 *
 * Only caches successful results (results without an `error` property).
 *
 * @example
 * ```typescript
 * const cachedRead = cached(readTool, "Read", { ttl: 5 * 60 * 1000 });
 * const stats = await cachedRead.getStats();
 * ```
 */
export function cached<T extends Tool>(
  tool: T,
  toolName: string,
  options: CacheOptions = {},
): CachedTool<T> {
  const {
    ttl = 5 * 60 * 1000,
    store = new LRUCacheStore(),
    keyGenerator = defaultKeyGenerator,
    debug = false,
    onHit,
    onMiss,
  } = options;

  let hits = 0;
  let misses = 0;
  const log = debug ? console.log.bind(console) : () => {};

  const cachedTool = {
    ...tool,
    execute: async (
      params: Parameters<NonNullable<T["execute"]>>[0],
      execOptions: Parameters<NonNullable<T["execute"]>>[1],
    ) => {
      const key = keyGenerator(toolName, params);
      const now = Date.now();

      const entry = await store.get(key);
      if (entry && now - entry.timestamp < ttl) {
        hits++;
        log(`[Cache] HIT ${toolName}:${key.slice(-8)}`);
        onHit?.(toolName, key);
        return entry.result;
      }

      misses++;
      log(`[Cache] MISS ${toolName}:${key.slice(-8)}`);
      onMiss?.(toolName, key);

      if (!tool.execute) throw new Error(`Tool ${toolName} has no execute function`);

      const result = await tool.execute(params, execOptions);

      if (result && typeof result === "object" && !("error" in result)) {
        await store.set(key, { result, timestamp: now });
      }

      return result;
    },

    async getStats(): Promise<CacheStats> {
      const total = hits + misses;
      const size = (await store.size?.()) ?? 0;
      return {
        hits,
        misses,
        hitRate: total > 0 ? hits / total : 0,
        size,
      };
    },

    async clearCache(key?: string): Promise<void> {
      if (key) {
        await store.delete(key);
      } else {
        await store.clear();
      }
    },
  };

  return cachedTool as CachedTool<T>;
}
