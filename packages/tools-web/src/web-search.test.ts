import { beforeEach, describe, expect, it, vi } from "vitest";
import { webSearch } from "./web-search.js";

const mockSearch = vi.fn();

vi.mock("parallel-web", () => {
  return {
    default: function ParallelMock() {
      return { beta: { search: mockSearch } };
    },
  };
});

describe("webSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses parallel provider by default", async () => {
    mockSearch.mockResolvedValue({
      results: [{ title: "A", url: "https://a.com", excerpts: ["snippet"] }],
    });

    const result = await webSearch(
      { apiKey: "parallel-key" },
      { query: "hello", allowed_domains: null, blocked_domains: null },
    );

    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      total_results: 1,
      query: "hello",
      results: [{ title: "A", url: "https://a.com", snippet: "snippet" }],
    });
  });

  it("uses you provider when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hits: [{ title: "B", url: "https://b.com", description: "desc" }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await webSearch(
      { apiKey: "you-key", provider: "you" },
      { query: "agent tools", allowed_domains: null, blocked_domains: null },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      total_results: 1,
      query: "agent tools",
      results: [{ title: "B", url: "https://b.com", snippet: "desc" }],
    });
  });

  it("returns provider error from you api", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await webSearch(
      { apiKey: "bad", provider: "you" },
      { query: "agent tools", allowed_domains: null, blocked_domains: null },
    );

    expect(result).toMatchObject({
      error: "You.com API request failed (401): Unauthorized",
    });
  });

  it("applies domain filters for you provider via query composition", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hits: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await webSearch(
      { apiKey: "you-key", provider: "you" },
      {
        query: "best agent framework",
        allowed_domains: ["github.com"],
        blocked_domains: ["example.com"],
      },
    );

    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain(
      encodeURIComponent("best agent framework site:github.com -site:example.com"),
    );
  });
});
