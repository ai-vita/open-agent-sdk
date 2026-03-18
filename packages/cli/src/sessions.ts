import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function getSessionDir(cwd: string): string {
  const abs = path.resolve(cwd);
  const hash = createHash("sha256").update(abs).digest("hex").slice(0, 12);
  const dir = path.join(homedir(), ".agents", "sessions", hash);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "metadata.json"), JSON.stringify({ path: abs }));
  return dir;
}

function generateTimestampFilename(): string {
  return new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "") + ".jsonl";
}

export interface SessionInfo {
  filename: string;
  path: string;
  messageCount: number;
  size: number;
}

export function listSessions(cwd: string): SessionInfo[] {
  const dir = getSessionDir(cwd);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort()
    .reverse();

  return files.map((f) => {
    const filePath = path.join(dir, f);
    const stat = statSync(filePath);
    const content = readFileSync(filePath, "utf-8");
    const messageCount = content.split("\n").filter(Boolean).length;
    return { filename: f, path: filePath, messageCount, size: stat.size };
  });
}

export function resolveSessionPath(
  cwd: string,
  opts: { continue?: boolean; resume?: string | boolean },
): { sessionPath: string; isNew: boolean } {
  const dir = getSessionDir(cwd);

  if (opts.continue) {
    const sessions = listSessions(cwd);
    if (sessions.length > 0) {
      return { sessionPath: sessions[0].path, isNew: false };
    }
    // No prior sessions — start fresh
    return { sessionPath: path.join(dir, generateTimestampFilename()), isNew: true };
  }

  if (opts.resume !== undefined && opts.resume !== false) {
    if (typeof opts.resume === "string") {
      // Match by timestamp prefix
      const sessions = listSessions(cwd);
      const match = sessions.find((s) => s.filename.startsWith(opts.resume as string));
      if (!match) {
        const available = sessions.map((s) => s.filename.replace(".jsonl", "")).join("\n  ");
        throw new Error(
          `No session matching "${opts.resume}".\nAvailable sessions:\n  ${available || "(none)"}`,
        );
      }
      return { sessionPath: match.path, isNew: false };
    }
    // bare --resume (true) — caller should show picker
    return { sessionPath: "", isNew: false };
  }

  // Default: new session
  return { sessionPath: path.join(dir, generateTimestampFilename()), isNew: true };
}

export function formatSessionList(sessions: SessionInfo[]): string {
  if (sessions.length === 0) return "No sessions found.";
  return sessions
    .map((s, i) => {
      const ts = s.filename.replace(".jsonl", "");
      const sizeKb = (s.size / 1024).toFixed(1);
      return `  ${i + 1}. ${ts}  (${s.messageCount} messages, ${sizeKb} KB)`;
    })
    .join("\n");
}
