import { describe, expect, it } from "vitest";
import { escapeXml, formatMessages, stripInternalTags } from "./format.js";
import type { InboundMessage } from "./types.js";

describe("escapeXml", () => {
  it('escapes &, <, >, and "', () => {
    expect(escapeXml('Tom & Jerry <script>"hello"</script>')).toBe(
      "Tom &amp; Jerry &lt;script&gt;&quot;hello&quot;&lt;/script&gt;",
    );
  });

  it("handles multiple special chars", () => {
    expect(escapeXml("a&b&c")).toBe("a&amp;b&amp;c");
  });

  it("returns plain string unchanged", () => {
    expect(escapeXml("hello world")).toBe("hello world");
  });
});

describe("formatMessages", () => {
  const msg = (overrides: Partial<InboundMessage> = {}): InboundMessage => ({
    id: "1",
    chatId: "chat-1",
    sender: "user-1",
    senderName: "Alice",
    content: "Hello",
    timestamp: "2024-01-15T10:30:00.000Z",
    channel: "telegram",
    ...overrides,
  });

  it("produces valid XML with sender, timestamp, content", () => {
    const result = formatMessages([msg()], "Family Chat");
    expect(result).toContain('<messages chat="Family Chat">');
    expect(result).toContain('sender="Alice"');
    expect(result).toContain(">Hello</message>");
    expect(result).toContain("</messages>");
  });

  it("handles multiple messages in chronological order", () => {
    const msgs = [
      msg({ id: "1", senderName: "Alice", content: "Hello" }),
      msg({ id: "2", senderName: "Bob", content: "Hi there" }),
    ];
    const result = formatMessages(msgs, "Chat");
    const aliceIdx = result.indexOf("Alice");
    const bobIdx = result.indexOf("Bob");
    expect(aliceIdx).toBeLessThan(bobIdx);
  });

  it("escapes special characters in sender names and content", () => {
    const result = formatMessages(
      [msg({ senderName: "Tom & Jerry", content: '<script>alert("xss")</script>' })],
      "Test",
    );
    expect(result).toContain("Tom &amp; Jerry");
    expect(result).toContain("&lt;script&gt;");
  });

  it("returns empty string for empty array", () => {
    expect(formatMessages([], "Chat")).toBe("");
  });

  it("converts timestamps to local time", () => {
    const result = formatMessages([msg()], "Chat");
    // Should contain a formatted time, not the raw ISO string
    expect(result).not.toContain("2024-01-15T10:30:00.000Z");
    expect(result).toMatch(/time=".*\d{2}.*"/);
  });
});

describe("stripInternalTags", () => {
  it("removes single-line internal blocks", () => {
    expect(stripInternalTags("Hello <internal>secret</internal> world")).toBe("Hello  world");
  });

  it("removes multi-line internal blocks", () => {
    const input = `Hello
<internal>
line 1
line 2
</internal>
world`;
    expect(stripInternalTags(input)).toBe("Hello\n\nworld");
  });

  it("removes multiple internal blocks", () => {
    expect(stripInternalTags("a <internal>x</internal> b <internal>y</internal> c")).toBe(
      "a  b  c",
    );
  });

  it("returns text unchanged if no internal tags", () => {
    expect(stripInternalTags("Hello world")).toBe("Hello world");
  });
});
