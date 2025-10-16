# 🏗️ Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│              WeChat Meeting Scribe - AI Meeting Secretary           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         External Services                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐               ┌──────────────────────────────┐    │
│  │   WeChat     │               │   Alibaba DeepSeek API       │    │
│  │  Web Server  │               │   (LLM Service)              │    │
│  └──────┬───────┘               └────────────┬─────────────────┘    │
│         │                                    │                      │
└─────────┼────────────────────────────────────┼──────────────────────┘
          │                                    │
          │ WebSocket                          │ HTTPS
          │                                    │
┌─────────▼────────────────────────────────────▼───────────────────────┐
│                         Bot Application Layer                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                      bot.ts (Main Logic)                    │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │     │
│  │  │ Event Handler│  │ Room Filter  │  │ Orchestrator │       │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                            │                                         │
│         ┌──────────────────┼──────────────────┐                      │
│         │                  │                  │                      │
│         ▼                  ▼                  ▼                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ Message      │  │  Summary     │  │  LLM         │                │
│  │ Buffer       │  │  Generator   │  │  Service     │                │
│  │              │  │              │  │              │                │
│  │ - Storage    │  │ - Format     │  │ - API Call   │                │
│  │ - Triggers   │  │ - Enrich     │  │ - Retry      │                │
│  │ - Stats      │  │ - Header     │  │ - Error      │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      Configuration & Utilities                       │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  config.ts   │  │  types.ts    │  │   .env       │                │
│  │              │  │              │  │              │                │
│  │ - Load env   │  │ - Interfaces │  │ - API Keys   │                │
│  │ - Validate   │  │ - Types      │  │ - Settings   │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Message Ingestion Flow

```
WeChat Group Message
        │
        ▼
┌───────────────────┐
│ Wechaty Puppet    │  (Receives via web protocol)
│ (puppet-wechat)   │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ bot.ts            │  onMessage(message: Message)
│ Event Handler     │
└────────┬──────────┘
         │
         ├─► Filter: Is from room?
         │
         ├─► Filter: Is target room?
         │
         ├─► Filter: Is text message?
         │
         ├─► Filter: Not from self?
         │
         ▼
┌───────────────────┐
│ BufferedMessage   │  { id, timestamp, sender, content, roomTopic }
│ Object Created    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ MessageBuffer     │  buffer.add(message)
│ Storage           │
└────────┬──────────┘
         │
         ├─► Check: Keyword trigger?
         ├─► Check: Volume trigger?
         ├─► Check: Time trigger?
         │
         ▼
    shouldSummarize()?
         │
    ┌────┴────┐
    │         │
   No        Yes
    │         │
  Return      ▼
         Generate Summary
```

---

### 2. Summary Generation Flow

```
Trigger Activated
      │
      ▼
┌──────────────────────┐
│ SummaryGenerator     │  generate(buffer)
│ Coordinator          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ MessageBuffer        │  formatMessagesForLLM()
│ Format Messages      │
└──────────┬───────────┘
           │
           │  ["[10:30] Alice: Hello", "[10:31] Bob: Hi", ...]
           │
           ▼
┌──────────────────────┐
│ LLMService           │  generateSummary(messages)
│ Build Prompt         │
└──────────┬───────────┘
           │
           │  System Prompt + User Messages
           │
           ▼
┌──────────────────────┐
│       LLM API        │  POST /chat/completions
└──────────┬───────────┘
           │
           │  Structured Summary Response
           │
           ▼
┌──────────────────────┐
│ SummaryGenerator     │  generateHeader() + format
│ Enrich Response      │
└──────────┬───────────┘
           │
           │  Full formatted summary
           │
           ▼
┌──────────────────────┐
│ bot.ts               │  room.say(summary)
│ Send to Self         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ MessageBuffer        │  buffer.clear()
│ Clear Buffer         │
└──────────────────────┘
           │
           ▼
      Summary Sent!
```

---

## Component Responsibilities

### bot.ts (Main Orchestrator)

**Responsibilities**:
- Initialize Wechaty instance
- Handle lifecycle events (scan, login, logout, error)
- Process incoming messages
- Filter rooms and messages
- Coordinate summary generation
- Manage interval timer

**Key Methods**:
- `setupEventHandlers()`: Register event listeners
- `onMessage()`: Process each message
- `isTargetRoom()`: Room filtering logic
- `checkKeywordTrigger()`: Keyword detection
- `generateAndSendSummary()`: Orchestrate summary flow
- `startIntervalTimer()`: Setup time-based trigger

---

### message-buffer.ts (Storage & Triggers)

**Responsibilities**:
- Store messages in memory
- Implement trigger logic (time/volume/keyword)
- Maintain buffer size limits
- Provide statistics
- Format messages for LLM

**Key Methods**:
- `add()`: Add message to buffer
- `shouldSummarize()`: Check all trigger conditions
- `formatMessagesForLLM()`: Prepare for API call
- `getStats()`: Return statistics
- `clear()`: Reset buffer after summary

**State**:
- `messages: BufferedMessage[]` - In-memory storage
- `lastSummaryTime: Date` - Track time trigger

---

### llm-service.ts (API Integration)

**Responsibilities**:
- Communicate with LLM API
- Build prompts for meeting minutes
- Handle API errors and retries
- Parse API responses

**Key Methods**:
- `chat()`: Generic LLM chat completion
- `generateSummary()`: Specialized for meeting minutes

**Error Handling**:
- Network timeouts
- API authentication errors
- Invalid response formats
- Rate limiting

---

### summary-generator.ts (Formatting)

**Responsibilities**:
- Coordinate summary generation
- Add header (date, time, statistics)
- Add footer (statistics)
- Handle edge cases (no messages)

**Key Methods**:
- `generate()`: Main entry point
- `generateHeader()`: Create header with date/time

---

### config.ts (Configuration)

**Responsibilities**:
- Load environment variables
- Validate required settings
- Provide type-safe config object
- Display startup configuration

**Key Functions**:
- `getEnv()`: String environment variables
- `getEnvNumber()`: Numeric environment variables
- `getEnvBoolean()`: Boolean environment variables
- `validateConfig()`: Validate and display config

---

## State Management

### Bot State

```
┌──────────────┐     scan       ┌──────────────┐
│  STARTING    │ ─────────────► │  SCANNING    │
└──────────────┘                └──────┬───────┘
                                       │ login
                                       │
                                       ▼
                                ┌──────────────┐
                       logout   │   LOGGED_IN  │
                      ┌─────────┤   (Active)   │
                      │         └──────┬───────┘
                      │                │ error
                      │                │
                      ▼                ▼
                ┌──────────────┐   ┌──────────────┐
                │  LOGGED_OUT  │   │    ERROR     │
                └──────────────┘   └──────────────┘
                      │                │
                      │ restart        │ restart
                      │                │
                      └────────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  STARTING    │
                        └──────────────┘
```

### Buffer State

```
Empty Buffer
     │
     │ add(message)
     ▼
Has Messages ◄─────┐
     │             │
     │ add()       │ add()
     ▼             │
Trigger Check      │
     │             │
     ├─► No ──────┘
     │
     ├─► Yes
     │
     ▼
Generating Summary
     │
     ▼
Sending to Room
     │
     ▼
clear()
     │
     ▼
Empty Buffer
```

---

## Trigger Logic

### Decision Tree

```
New Message Arrives
        │
        ▼
    Add to Buffer
        │
        ▼
┌───────────────────┐
│ Check Min Messages│
│ count >= MIN?     │
└────────┬──────────┘
         │
    ┌────┴────┐
   No        Yes
    │         │
  Return      ▼
         ┌──────────────────┐
         │ Keyword in msg?  │
         └────────┬─────────┘
                  │
            ┌─────┴─────┐
           Yes          No
            │            │
      Summarize!         ▼
                    ┌──────────────────┐
                    │ Volume reached?  │
                    └────────┬─────────┘
                             │
                       ┌─────┴─────┐
                      Yes          No
                       │            │
                 Summarize!         ▼
                             ┌──────────────────┐
                             │ Time elapsed?    │
                             └────────┬─────────┘
                                      │
                                ┌─────┴─────┐
                               Yes          No
                                │            │
                          Summarize!      Return
```

---

## Error Handling Strategy

### Layer 1: API Level (llm-service.ts)

```
API Call
   │
   ├─► Network Error ──► Return { error: "Network error..." }
   │
   ├─► Timeout ──────► Return { error: "Timeout..." }
   │
   ├─► Auth Error ───► Return { error: "API Error: 401..." }
   │
   └─► Success ──────► Return { content: "..." }
```

### Layer 2: Generation Level (summary-generator.ts)

```
Generate Summary
   │
   ├─► No Messages ──► Return "暂无消息..."
   │
   ├─► LLM Error ────► Return "❌ 生成纪要时出错..."
   │
   └─► Success ──────► Return formatted summary
```

### Layer 3: Bot Level (bot.ts)

```
Generate & Send
   │
   ├─► Error ──────────► Log error
   │                     │
   │                     └─► Send error message to room
   │                         │
   │                         └─► Continue running
   │
   └─► Success ────────► Clear buffer
                         │
                         └─► Continue running
```

---

## Configuration Precedence

```
1. Environment Variables (.env file)
        │
        ▼
2. Default Values (config.ts)
        │
        ▼
3. Runtime Behavior
```

### Example Flow

```
User sets: SUMMARY_INTERVAL_MINUTES=30

↓ config.ts loads

intervalMinutes = getEnvNumber('SUMMARY_INTERVAL_MINUTES', 30)

↓ bot.ts checks on login

if (config.summaryTrigger.intervalMinutes > 0) {
  startIntervalTimer()
}

↓ Timer runs every 30 minutes

setInterval(() => {
  if (buffer.shouldSummarize(false)) {
    // generate summary
  }
}, 30 * 60 * 1000)
```

---

## Security Architecture

### Data Flow Security

```
User Message (WeChat)
        │ ── Encrypted by WeChat
        ▼
Wechaty Puppet (Local)
        │ ── In-memory only
        ▼
Message Buffer (Local)
        │ ── Temporary storage
        ▼
LLM API (External)
        │ ── HTTPS, Bearer Token
        ▼
Summary Generated
        │ ── In-memory only
        ▼
Sent to WeChat Room
        │ ── Encrypted by WeChat
        ▼
User Receives
```

### Secrets Management

```
.env file (NOT in git)
    │
    ├─► LLM_API_KEY ──► Used only in llm-service.ts
    │                   Never logged or exposed
    │
    └─► Other settings ──► Loaded at startup
                           Validated by config.ts
```

---

## Scalability Considerations

### Current Limitations

1. **Single Instance**: One bot = one WeChat account
2. **In-Memory Buffer**: Lost on restart
3. **Single Room Buffer**: Shared across all rooms
4. **No Persistence**: No database

### Potential Improvements

```
Current Architecture:
┌──────────────┐
│   Bot        │ ──► In-memory buffer
│   Instance   │ ──► No persistence
└──────────────┘

Future Architecture:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Bot        │ ──► │   Redis      │ ──► │  PostgreSQL  │
│   Instance   │     │   (Buffer)   │     │  (History)   │
└──────────────┘     └──────────────┘     └──────────────┘
        │
        ├─► Per-room buffers
        ├─► Distributed locking
        └─► Horizontal scaling
```

---

## Performance Characteristics

### Time Complexity

- `add()`: O(1)
- `shouldSummarize()`: O(1)
- `formatMessagesForLLM()`: O(n) where n = buffer size
- `generateSummary()`: O(n) + API latency

### Space Complexity

- Buffer: O(n) where n = MAX_BUFFER_SIZE (default: 200)
- Each message: ~100-500 bytes
- Total memory: < 1MB for buffer

### Latency

- Message processing: < 10ms
- LLM API call: 2-10 seconds (network + generation)
- Total summary generation: 2-10 seconds

---

## Deployment Topologies

### Development

```
┌──────────────────────────┐
│  Developer Machine       │
│  ┌────────────────────┐  │
│  │  npm run dev       │  │
│  │  (tsx watch mode)  │  │
│  └────────────────────┘  │
│           │              │
│           ▼              │
│  ┌────────────────────┐  │
│  │  WeChat Login      │  │
│  │  (browser visible) │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Production (Simple)

```
┌──────────────────────────┐
│  Server (VPS/Cloud)      │
│  ┌────────────────────┐  │
│  │  npm start         │  │
│  │  (headless mode)   │  │
│  └────────────────────┘  │
│           │              │
│           ▼              │
│  ┌────────────────────┐  │
│  │  PM2 / systemd     │  │
│  │  (process manager) │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Production (Advanced)

```
┌────────────────────────────────────┐
│  Docker Container                  │
│  ┌──────────────────────────────┐  │
│  │  Node.js App                 │  │
│  │  + Chromium (puppeteer)      │  │
│  └──────────────────────────────┘  │
│           │                        │
│           ▼                        │
│  ┌──────────────────────────────┐  │
│  │  Mounted Volumes             │  │
│  │  - .env (secrets)            │  │
│  │  - logs/                     │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────┐
│  Orchestration (k8s/docker-compose)│
└────────────────────────────────────┘
```

---

## Monitoring & Observability

### Current Logging

```
Console Logs:
├── 🤖 Bot lifecycle (start, login, logout)
├── 📱 QR code for scanning
├── [Buffer] Message operations
├── [LLM] API calls
├── [Summary] Generation status
└── ❌ Errors with stack traces
```

### Recommended Additions

```
Future Monitoring:
├── Structured JSON logs
├── Log levels (DEBUG, INFO, WARN, ERROR)
├── Metrics (message rate, API latency, buffer size)
├── Health check endpoint
└── APM integration (Datadog, New Relic, etc.)
```

---

This architecture is designed for simplicity, reliability, and extensibility. It can handle typical use cases (1-10 groups, <100 messages/minute) efficiently while remaining easy to understand and modify.

---

**Last Updated**: 2025-10-17
**Version**: 1.0.0
