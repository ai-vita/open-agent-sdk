import path from "node:path";
import { LocalSandbox } from "@open-agent-sdk/sandbox-local";
import { config as dotenvConfig } from "dotenv";
import type { NanoclawConfig } from "./types.js";

/** Load .env from ~/.agents/.env (same as CLI). */
function loadDotenv(): void {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  dotenvConfig({ path: path.join(home, ".agents", ".env") });
}

/** Load configuration from environment variables with defaults. */
export function loadConfig(): NanoclawConfig {
  loadDotenv();

  const dataDir = process.env.NANOCLAW_DATA_DIR || "./data";

  return {
    name: process.env.NANOCLAW_NAME || "Andy",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    apiKey: process.env.AI_GATEWAY_API_KEY || "",
    model: process.env.NANOCLAW_MODEL || "anthropic/claude-sonnet-4-6",
    pollInterval: Number.parseInt(process.env.NANOCLAW_POLL_INTERVAL || "2000", 10),
    maxSteps: Number.parseInt(process.env.NANOCLAW_MAX_STEPS || "20", 10),
    dataDir,
    createSandbox: (groupDir: string) => new LocalSandbox({ cwd: groupDir }),
  };
}
