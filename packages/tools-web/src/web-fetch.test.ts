import { beforeEach, describe, expect, it, vi } from "vitest";
import { webFetch } from "./web-fetch.js";

const mockExtract = vi.fn();

vi.mock("parallel-web", () => {
  return {
    default: function ParallelMock() {
      return { beta: { extract: mockExtract } };
    },
  };
});

const API_KEY = "test-key";
const URL = "https://example.com";
const PROMPT = "Summarize the main points";

const execute = (input: { url: string; prompt: string }) => webFetch(API_KEY, input);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("webFetchExecute", () => {
  it("passes prompt as objective to extract", async () => {
    mockExtract.mockResolvedValue({
      results: [{ url: URL, full_content: "page content", excerpts: [] }],
    });

    await execute({ url: URL, prompt: PROMPT });

    expect(mockExtract).toHaveBeenCalledWith(
      expect.objectContaining({ objective: PROMPT, urls: [URL] }),
    );
  });

  it("returns extracted full_content directly without generateText", async () => {
    mockExtract.mockResolvedValue({
      results: [{ url: URL, full_content: "full page content" }],
    });

    const result = await execute({ url: URL, prompt: PROMPT });

    expect(result).toMatchObject({ response: "full page content", url: URL });
  });

  it("falls back to joined excerpts when full_content is absent", async () => {
    mockExtract.mockResolvedValue({
      results: [{ url: URL, excerpts: ["part one", "part two"] }],
    });

    const result = await execute({ url: URL, prompt: PROMPT });

    expect(result).toMatchObject({ response: "part one\n\npart two", url: URL });
  });

  it("returns error when no results", async () => {
    mockExtract.mockResolvedValue({ results: [] });

    const result = await execute({ url: URL, prompt: PROMPT });

    expect(result).toMatchObject({ error: "No content extracted from URL" });
  });

  it("returns error when content is empty", async () => {
    mockExtract.mockResolvedValue({
      results: [{ url: URL, full_content: "", excerpts: [] }],
    });

    const result = await execute({ url: URL, prompt: PROMPT });

    expect(result).toMatchObject({ error: "No content available from URL" });
  });
});
