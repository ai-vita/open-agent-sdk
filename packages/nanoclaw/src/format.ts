import type { InboundMessage } from "./types.js";

/** Escape XML special characters. */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format a local time string from an ISO timestamp. */
function formatTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Format messages as XML for the agent's context. */
export function formatMessages(messages: InboundMessage[], chatName: string): string {
  if (messages.length === 0) return "";

  const lines: string[] = [`<messages chat="${escapeXml(chatName)}">`];

  for (const msg of messages) {
    const time = formatTime(msg.timestamp);
    const sender = escapeXml(msg.senderName);
    const content = escapeXml(msg.content);
    lines.push(`  <message sender="${sender}" time="${time}">${content}</message>`);
  }

  lines.push("</messages>");
  return lines.join("\n");
}

/** Remove <internal>...</internal> blocks from agent output. */
export function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, "").trim();
}
