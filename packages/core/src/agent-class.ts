import type { LanguageModel, ModelMessage } from "ai";
import type { StopWhen } from "./agent.js";
import { runAgent } from "./agent.js";
import type { AgentEvent } from "./agent-events.js";
import {
  type CompactConversationConfig,
  type CompactConversationState,
  compactConversation,
  contextNeedsCompaction,
} from "./compaction.js";
import type { SessionManager } from "./session/session-manager.js";
import type { ToolSet } from "./tool-types.js";

export interface AgentCompactionConfig {
  /** Model's context limit */
  maxTokens: number;
  /** Tokens of recent conversation to keep (default: 20000) */
  keepRecentTokens?: number;
  /** Tokens reserved for summary output (default: 16384) */
  reserveTokens?: number;
  /** Model to use for summarization (defaults to the agent's model) */
  summarizerModel?: LanguageModel;
}

export interface AgentConfig {
  /** Language model to use */
  model: LanguageModel;
  /** Tool set */
  tools?: ToolSet;
  /** System prompt */
  system?: string;
  /** Stop condition(s) */
  stopWhen?: StopWhen | StopWhen[];
  /** Enable streaming (default: false) */
  stream?: boolean;
  /** Maximum steps per generate/stream call (default: 20) */
  maxSteps?: number;
  /** Optional session manager for persistence */
  sessionManager?: SessionManager;
  /** Optional compaction config for auto-compaction */
  compaction?: AgentCompactionConfig;
}

/**
 * Stateful Agent class that wraps runAgent() with managed conversation state,
 * session persistence, auto-compaction, and message steering.
 */
export class Agent {
  private config: AgentConfig;
  private messages: ModelMessage[] = [];
  private steeredMessages: ModelMessage[] = [];
  private compactionState: CompactConversationState = { conversationSummary: "" };

  constructor(config: AgentConfig) {
    this.config = config;

    // Resume from session if available
    if (config.sessionManager) {
      this.messages = config.sessionManager.getMessages();
    }
  }

  /**
   * Queue a message to be injected before the next generate/stream call.
   * The steered message is consumed after one use.
   */
  steer(message: ModelMessage): void {
    this.steeredMessages.push(message);
  }

  /**
   * Run the agent with a prompt, collecting all events.
   * Returns the array of events (including the final DoneEvent).
   */
  async generate(prompt: string | ModelMessage[]): Promise<AgentEvent[]> {
    const previousLength = this.messages.length;
    const inputMessages = this.buildMessages(prompt);
    const events: AgentEvent[] = [];

    for await (const event of runAgent({
      model: this.config.model,
      tools: this.config.tools,
      system: this.config.system,
      messages: inputMessages,
      stopWhen: this.config.stopWhen,
      stream: false,
      maxSteps: this.config.maxSteps,
    })) {
      events.push(event);
      if (event.type === "done") {
        this.messages = event.messages;
      }
    }

    this.clearSteeredMessages();
    await this.persistToSession(previousLength);
    await this.autoCompact();

    return events;
  }

  /**
   * Run the agent with streaming, yielding events as they arrive.
   */
  async *stream(prompt: string | ModelMessage[]): AsyncGenerator<AgentEvent> {
    const previousLength = this.messages.length;
    const inputMessages = this.buildMessages(prompt);

    for await (const event of runAgent({
      model: this.config.model,
      tools: this.config.tools,
      system: this.config.system,
      messages: inputMessages,
      stopWhen: this.config.stopWhen,
      stream: true,
      maxSteps: this.config.maxSteps,
    })) {
      if (event.type === "done") {
        this.messages = event.messages;
      }
      yield event;
    }

    this.clearSteeredMessages();
    await this.persistToSession(previousLength);
    await this.autoCompact();
  }

  /** Get current conversation messages. */
  getMessages(): readonly ModelMessage[] {
    return this.messages;
  }

  private buildMessages(prompt: string | ModelMessage[]): ModelMessage[] {
    const userMessages: ModelMessage[] =
      typeof prompt === "string" ? [{ role: "user", content: prompt }] : prompt;

    return [...this.messages, ...this.steeredMessages, ...userMessages];
  }

  private clearSteeredMessages(): void {
    this.steeredMessages = [];
  }

  private async persistToSession(previousLength: number): Promise<void> {
    if (!this.config.sessionManager) return;

    for (const msg of this.messages.slice(previousLength)) {
      this.config.sessionManager.append(msg);
    }
  }

  private async autoCompact(): Promise<void> {
    if (!this.config.compaction) return;

    const { maxTokens, reserveTokens } = this.config.compaction;

    if (!contextNeedsCompaction(this.messages, maxTokens, reserveTokens)) {
      return;
    }

    const compactionConfig: CompactConversationConfig = {
      maxTokens,
      keepRecentTokens: this.config.compaction.keepRecentTokens,
      reserveTokens,
      summarizerModel: this.config.compaction.summarizerModel ?? this.config.model,
    };

    const result = await compactConversation(this.messages, compactionConfig, this.compactionState);

    if (result.didCompact) {
      this.messages = result.messages;
      this.compactionState = result.state;
    }
  }
}
