import type { ToolSet } from "ai";
import { cached, LRUCacheStore, type CacheStore } from "@open-agent-sdk/core";
import type { Sandbox, ToolConfig } from "@open-agent-sdk/core";
import { createBashTool } from "./bash.js";
import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";
import { createEditTool } from "./edit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";
import { createAskUserTool, type AskUserResponseHandler } from "./ask-user.js";
import { createEnterPlanModeTool, createExitPlanModeTool, type PlanModeState } from "./plan-mode.js";
import { createTodoWriteTool, type TodoState, type TodoItem } from "./todo-write.js";
import { createWebSearchTool, type WebSearchConfig } from "./web-search.js";
import { createWebFetchTool, type WebFetchConfig } from "./web-fetch.js";

/** Which tools are cached by default when cache is enabled */
const DEFAULT_CACHEABLE = ["Read", "Glob", "Grep", "WebFetch", "WebSearch"] as const;

/**
 * Cache configuration for createAgentTools.
 * - `true` — LRU cache with 5min TTL for Read, Glob, Grep
 * - `CacheStore` — custom store for all default cacheable tools
 * - object — full control with per-tool flags
 */
export type CacheConfig =
  | boolean
  | CacheStore
  | {
      store?: CacheStore;
      ttl?: number;
      debug?: boolean;
      onHit?: (toolName: string, key: string) => void;
      onMiss?: (toolName: string, key: string) => void;
      keyGenerator?: (toolName: string, params: unknown) => string;
      [toolName: string]: unknown;
    };

export interface AgentToolsConfig {
  /** Per-tool configuration overrides */
  tools?: {
    Bash?: ToolConfig;
    Read?: ToolConfig;
    Write?: ToolConfig;
    Edit?: ToolConfig;
    Glob?: ToolConfig;
    Grep?: ToolConfig;
  };
  /** Include AskUser tool */
  askUser?: { onQuestion?: AskUserResponseHandler };
  /** Include EnterPlanMode / ExitPlanMode tools */
  planMode?: boolean;
  /** Include TodoWrite tool */
  todoWrite?: { onUpdate?: (todos: TodoItem[]) => void };
  /** Include WebSearch tool */
  webSearch?: WebSearchConfig;
  /** Include WebFetch tool */
  webFetch?: WebFetchConfig;
  /** Enable tool result caching */
  cache?: CacheConfig;
  /** Default timeout for sandbox tools */
  defaultTimeout?: number;
}

export interface AgentToolsResult {
  /** All configured tools for use with generateText/streamText */
  tools: ToolSet;
  /** Shared plan mode state (present when planMode is enabled) */
  planModeState?: PlanModeState;
  /** Shared todo state (present when todoWrite is enabled) */
  todoState?: TodoState;
}

/**
 * Creates all standard tools in one call.
 *
 * Default tools (always included): Bash, Read, Write, Edit, Glob, Grep
 * Optional tools (via config): AskUser, EnterPlanMode, ExitPlanMode, TodoWrite, WebSearch, WebFetch
 *
 * @example
 * ```typescript
 * const { tools } = createAgentTools(sandbox);
 * const result = await generateText({ model, tools, prompt: "..." });
 * ```
 */
export function createAgentTools(
  sandbox: Sandbox,
  config?: AgentToolsConfig,
): AgentToolsResult {
  const toolsConfig = config?.tools ?? {};
  const timeout = config?.defaultTimeout;

  const baseBashConfig: ToolConfig = { maxOutputLength: 30000, ...toolsConfig.Bash };
  if (timeout && !baseBashConfig.timeout) baseBashConfig.timeout = timeout;

  const tools: ToolSet = {
    Bash: createBashTool(sandbox, baseBashConfig),
    Read: createReadTool(sandbox, toolsConfig.Read),
    Write: createWriteTool(sandbox, toolsConfig.Write),
    Edit: createEditTool(sandbox, toolsConfig.Edit),
    Glob: createGlobTool(sandbox, toolsConfig.Glob),
    Grep: createGrepTool(sandbox, toolsConfig.Grep),
  };

  let planModeState: PlanModeState | undefined;
  let todoState: TodoState | undefined;

  if (config?.askUser) {
    tools.AskUser = createAskUserTool(config.askUser.onQuestion);
  }

  if (config?.planMode) {
    planModeState = { isActive: false };
    tools.EnterPlanMode = createEnterPlanModeTool(planModeState);
    tools.ExitPlanMode = createExitPlanModeTool();
  }

  if (config?.todoWrite) {
    todoState = { todos: [] };
    tools.TodoWrite = createTodoWriteTool(todoState, config.todoWrite.onUpdate);
  }

  if (config?.webSearch) {
    tools.WebSearch = createWebSearchTool(config.webSearch);
  }

  if (config?.webFetch) {
    tools.WebFetch = createWebFetchTool(config.webFetch);
  }

  // Apply caching
  if (config?.cache) {
    const { store, ttl, debug, onHit, onMiss, keyGenerator, enabled } = resolveCache(config.cache);
    if (store) {
      for (const [name, t] of Object.entries(tools)) {
        if (enabled.has(name)) {
          (tools as Record<string, unknown>)[name] = cached(t, name, {
            store,
            ttl,
            debug,
            onHit,
            onMiss,
            keyGenerator,
          });
        }
      }
    }
  }

  return { tools, planModeState, todoState };
}

function resolveCache(config: CacheConfig): {
  store: CacheStore | null;
  ttl: number;
  debug: boolean;
  onHit?: (toolName: string, key: string) => void;
  onMiss?: (toolName: string, key: string) => void;
  keyGenerator?: (toolName: string, params: unknown) => string;
  enabled: Set<string>;
} {
  if (!config) return { store: null, ttl: 0, debug: false, enabled: new Set() };

  if (config === true) {
    return {
      store: new LRUCacheStore(),
      ttl: 5 * 60 * 1000,
      debug: false,
      enabled: new Set(DEFAULT_CACHEABLE),
    };
  }

  if (
    typeof config === "object" &&
    typeof (config as CacheStore).get === "function" &&
    typeof (config as CacheStore).set === "function"
  ) {
    return {
      store: config as CacheStore,
      ttl: 5 * 60 * 1000,
      debug: false,
      enabled: new Set(DEFAULT_CACHEABLE),
    };
  }

  const cfg = config as {
    store?: CacheStore;
    ttl?: number;
    debug?: boolean;
    onHit?: (toolName: string, key: string) => void;
    onMiss?: (toolName: string, key: string) => void;
    keyGenerator?: (toolName: string, params: unknown) => string;
    [key: string]: unknown;
  };

  const enabled = new Set<string>(DEFAULT_CACHEABLE);
  const reserved = ["store", "ttl", "debug", "onHit", "onMiss", "keyGenerator"];
  for (const [key, value] of Object.entries(cfg)) {
    if (reserved.includes(key)) continue;
    if (value === true) enabled.add(key);
    if (value === false) enabled.delete(key);
  }

  return {
    store: cfg.store ?? new LRUCacheStore(),
    ttl: cfg.ttl ?? 5 * 60 * 1000,
    debug: cfg.debug ?? false,
    onHit: cfg.onHit,
    onMiss: cfg.onMiss,
    keyGenerator: cfg.keyGenerator,
    enabled,
  };
}
