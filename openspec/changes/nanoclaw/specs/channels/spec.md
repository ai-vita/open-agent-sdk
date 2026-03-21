## Channels Spec

### Channel Interface

Channels are vendor-agnostic adapters that bridge external messaging platforms to the nanoclaw message store. The daemon doesn't know or care which channel a message came from — it reads from SQLite and sends via the channel that owns the chat ID.

### Registration Pattern (from nanoclaw channels/registry.test.ts)

- `registerChannel(name, factory)` registers a factory function
- `getChannelFactory(name)` returns the factory or undefined
- `getRegisteredChannelNames()` returns all registered names
- Later registration overwrites earlier (last-wins)
- Factories return `Channel | null` — null means credentials not configured, skip silently

### Channel Contract

```
Channel {
  name: string (readonly)
  connect(): Promise<void>
  sendMessage(chatId: string, text: string): Promise<void>
  disconnect(): Promise<void>
  ownsChat?(chatId: string): boolean
  setTyping?(chatId: string, isTyping: boolean): Promise<void>
}
```

### ChannelFactory Contract

```
(opts: { onMessage: (msg: InboundMessage) => void }) => Channel | null
```

The `onMessage` callback is how channels push inbound messages to the daemon. The daemon stores them in SQLite; the message loop picks them up on next poll.

### InboundMessage

```
{
  id: string           — channel-specific message ID
  chatId: string       — chat/group identifier
  sender: string       — sender identifier
  senderName: string   — display name
  content: string      — message text
  timestamp: string    — ISO 8601
  channel: string      — source channel name (e.g. "telegram", "terminal")
  isFromMe?: boolean   — bot's own messages
}
```

### MVP Channels

**Telegram (grammY)**
- Enabled when `TELEGRAM_BOT_TOKEN` env var is set
- Uses long polling (not webhooks) for simplicity
- Maps `ctx.chat.id` to `chatId`, `ctx.from.id` to `sender`
- Supports `setTyping` via `sendChatAction("typing")`

**Terminal (stdin/stdout)**
- Always available as fallback
- Simulates a single "main" chat with chatId "terminal"
- Uses `readline` for input
- Activated when no other channels connect, or via `--terminal` flag

### Daemon Startup

```
for each registered factory:
  channel = factory({ onMessage })
  if channel !== null:
    await channel.connect()
    activeChannels.push(channel)

if activeChannels.length === 0:
  activate terminal channel
```

### Message Routing (Outbound)

When the agent produces a response for a `chatId`, the daemon finds the channel that owns that chat:
1. Check `channel.ownsChat(chatId)` if implemented
2. Otherwise, look up `chatId → channel` mapping from the `chats` table (populated on inbound messages via `storeChatMetadata`)
- Terminal channel owns "terminal"
- Telegram channel owns numeric chat IDs received from Telegram

### Graceful Shutdown

On SIGINT/SIGTERM:
1. Stop message loop
2. `channel.disconnect()` for each active channel
3. Close SQLite database
