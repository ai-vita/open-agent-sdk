/**
 * Middle-truncates text, keeping the first half and last half with a
 * marker in between. Preserves both the beginning context and the
 * actionable end (error summaries, test failures).
 */
export function middleTruncate(text: string, maxLength: number): string {
  if (!Number.isFinite(maxLength) || maxLength < 0) return text;
  if (text.length <= maxLength) return text;

  const headLength = Math.floor(maxLength / 2);
  const tailLength = maxLength - headLength;
  const omitted = text.length - headLength - tailLength;

  let totalLines = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) totalLines++;
  }

  return (
    `[Total output lines: ${totalLines}]\n\n` +
    text.slice(0, headLength) +
    `\n\n…${omitted} chars truncated…\n\n` +
    text.slice(text.length - tailLength)
  );
}

/**
 * Type guard for AI SDK tool call content parts.
 */
export function isToolCallPart(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as Record<string, unknown>).type === "tool-call"
  );
}

/**
 * Type guard for AI SDK tool result content parts.
 */
export function isToolResultPart(part: unknown): boolean {
  return (
    typeof part === "object" &&
    part !== null &&
    (part as Record<string, unknown>).type === "tool-result"
  );
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
