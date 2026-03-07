import { describe, it, expect, vi } from "vitest";
import { LRUCacheStore, cached } from "./cache.js";
import { middleTruncate } from "./utils.js";
import { composeStops } from "./agent.js";
import { tool } from "ai";
import { z } from "zod";

describe("LRUCacheStore", () => {
  it("stores and retrieves entries", () => {
    const store = new LRUCacheStore<string>();
    store.set("key1", { result: "value1", timestamp: Date.now() });
    expect(store.get("key1")?.result).toBe("value1");
  });

  it("evicts LRU entry at capacity", () => {
    const store = new LRUCacheStore<string>(2);
    store.set("a", { result: "a", timestamp: 1 });
    store.set("b", { result: "b", timestamp: 2 });
    // Access 'a' to make it recently used
    store.get("a");
    // Adding 'c' should evict 'b' (least recently used)
    store.set("c", { result: "c", timestamp: 3 });
    expect(store.get("b")).toBeUndefined();
    expect(store.get("a")?.result).toBe("a");
    expect(store.get("c")?.result).toBe("c");
  });

  it("reports size", () => {
    const store = new LRUCacheStore<number>();
    store.set("k1", { result: 1, timestamp: 1 });
    store.set("k2", { result: 2, timestamp: 2 });
    expect(store.size()).toBe(2);
  });

  it("clears all entries", () => {
    const store = new LRUCacheStore<number>();
    store.set("k1", { result: 1, timestamp: 1 });
    store.clear();
    expect(store.size()).toBe(0);
  });
});

function makeTestTool() {
  return tool({
    description: "Test tool",
    inputSchema: z.object({ value: z.string() }),
    execute: async ({ value }: { value: string }) => ({ result: value }),
  });
}

describe("cached()", () => {
  it("returns cached result on second call", async () => {
    const executeSpy = vi.fn(async ({ value }: { value: string }) => ({ result: value }));
    const testTool = tool({
      description: "Test",
      inputSchema: z.object({ value: z.string() }),
      execute: executeSpy,
    });

    const cachedTool = cached(testTool, "Test");
    await cachedTool.execute!({ value: "hello" }, undefined as never);
    await cachedTool.execute!({ value: "hello" }, undefined as never);

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it("does not cache error results", async () => {
    const executeSpy = vi.fn(async () => ({ error: "something failed" }));
    const testTool = tool({
      description: "Test",
      inputSchema: z.object({}),
      execute: executeSpy,
    });

    const cachedTool = cached(testTool, "Test");
    await cachedTool.execute!({}, undefined as never);
    await cachedTool.execute!({}, undefined as never);

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it("tracks hit/miss stats", async () => {
    const testTool = makeTestTool();
    const cachedTool = cached(testTool, "Test");

    await cachedTool.execute!({ value: "x" }, undefined as never);
    await cachedTool.execute!({ value: "x" }, undefined as never);
    await cachedTool.execute!({ value: "y" }, undefined as never);

    const stats = await cachedTool.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBeCloseTo(1 / 3);
  });

  it("clears cache on clearCache()", async () => {
    const executeSpy = vi.fn(async ({ value }: { value: string }) => ({ result: value }));
    const testTool = tool({
      description: "Test",
      inputSchema: z.object({ value: z.string() }),
      execute: executeSpy,
    });
    const cachedTool = cached(testTool, "Test");

    await cachedTool.execute!({ value: "abc" }, undefined as never);
    await cachedTool.clearCache();
    await cachedTool.execute!({ value: "abc" }, undefined as never);

    expect(executeSpy).toHaveBeenCalledTimes(2);
  });

  it("respects TTL expiration", async () => {
    const executeSpy = vi.fn(async ({ value }: { value: string }) => ({ result: value }));
    const testTool = tool({
      description: "Test",
      inputSchema: z.object({ value: z.string() }),
      execute: executeSpy,
    });

    const store = new LRUCacheStore();
    // Pre-populate with an expired entry
    store.set("Test:ce2f9c31f0b4e21c", { result: { result: "stale" }, timestamp: 0 });

    const cachedTool = cached(testTool, "Test", { store, ttl: 100 });
    // This should miss because timestamp: 0 is expired
    await cachedTool.execute!({ value: "hello" }, undefined as never);

    expect(executeSpy).toHaveBeenCalledTimes(1);
  });
});

describe("middleTruncate", () => {
  it("leaves short text unchanged", () => {
    expect(middleTruncate("short", 100)).toBe("short");
  });

  it("truncates long text with marker", () => {
    const result = middleTruncate("a".repeat(100), 20);
    expect(result).toContain("truncated");
    expect(result.length).toBeGreaterThan(20);
  });
});

describe("stopConditions", () => {
  it("composeStops stops when any condition is true", () => {
    const neverStop = () => false;
    const alwaysStop = () => true;
    const composed = composeStops(neverStop, alwaysStop);
    expect(composed({} as never)).toBe(true);
  });

  it("composeStops continues when all false", () => {
    const neverStop = () => false;
    const composed = composeStops(neverStop, neverStop);
    expect(composed({} as never)).toBe(false);
  });
});
