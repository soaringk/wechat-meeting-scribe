# 🏗️ Architecture Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│              WeChat Meeting Scribe - AI Meeting Secretary           │
│                        (Go + openwechat)                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         External Services                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐               ┌──────────────────────────────┐    │
│  │   WeChat     │               │       LLM Provider           │    │
│  │   Server     │               │  (Gemini/OpenAI/etc)         │    │
│  └──────┬───────┘               └────────────┬─────────────────┘    │
│         │                                    │                      │
└─────────┼────────────────────────────────────┼──────────────────────┘
          │                                    │
          │ HTTP/HTTPS                         │ HTTPS
          │ (Desktop Protocol)                 │
┌─────────▼────────────────────────────────────▼───────────────────────┐
│                         Bot Application Layer                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                      bot/bot.go (Main Logic)                │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │     │
│  │  │ Event Handler│  │ Room Filter  │  │ Orchestrator │       │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                            │                                         │
│         ┌──────────────────┼──────────────────┐                      │
│         │                  │                  │                      │
│         ▼                  ▼                  ▼                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ buffer/      │  │  summary/    │  │  llm/        │                │
│  │ buffer.go    │  │  generator.go│  │  service.go  │                │
│  │              │  │              │  │              │                │
│  │ - Storage    │  │ - Format     │  │ - API Call   │                │
│  │ - Triggers   │  │ - Enrich     │  │ - OpenAI SDK │                │
│  │ - Stats      │  │ - Header     │  │ - Error      │                │
│  │ - Mutex Lock │  │              │  │              │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      Configuration & Storage                         │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │ config/      │  │  main.go     │  │   .env       │                │
│  │ config.go    │  │              │  │              │                │
│  │              │  │ - Entry pt   │  │ - API Keys   │                │
│  │ - Load env   │  │ - Signals    │  │ - Settings   │                │
│  │ - Validate   │  │ - Lifecycle  │  │              │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
│                                                                       │
│  ┌──────────────┐                                                    │
│  │ storage.json │  (Hot login session storage)                       │
│  └──────────────┘                                                    │
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
│ openwechat SDK    │  (Receives via Desktop protocol)
│                   │  Bypasses web login restrictions
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ bot.handleMessage │  handleMessage(*openwechat.Message)
│ Event Handler     │
└────────┬──────────┘
         │
         ├─► Filter: Not from self?
         │
         ├─► Filter: Is text message?
         │
         ├─► Filter: Is from group?
         │
         ├─► Filter: Is target room?
         │
         ▼
┌───────────────────┐
│ BufferedMessage   │  buffer.BufferedMessage{...}
│ Struct Created    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ MessageBuffer     │  buffer.Add(msg) - thread-safe with mutex
│ Storage           │
└────────┬──────────┘
         │
         ├─► Check: Keyword trigger?
         ├─► Check: Volume trigger?
         ├─► Check: Time trigger?
         │
         ▼
    ShouldSummarize()?
         │
    ┌────┴────┐
    │         │
   No        Yes
    │         │
  Return      ▼
         Generate Summary (in goroutine)
```

---

### 2. Summary Generation Flow

```
Trigger Activated
      │
      ▼
┌──────────────────────┐
│ generator.Generate() │  Generate(buffer, roomTopic)
│ Coordinator          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ buffer.Format...()   │  FormatMessagesForLLM(roomTopic)
│ Format Messages      │
└──────────┬───────────┘
           │
           │  []string{"[10:30] Alice: Hello", "[10:31] Bob: Hi", ...}
           │
           ▼
┌──────────────────────┐
│ llm.GenerateSummary()│  GenerateSummary(messages)
│ Build Prompt         │
└──────────┬───────────┘
           │
           │  System Prompt + User Messages
           │
           ▼
┌──────────────────────┐
│  LLM API (OpenAI SDK)│  CreateChatCompletion()
└──────────┬───────────┘
           │
           │  Structured Summary Response
           │
           ▼
┌──────────────────────┐
│ generator.Generate() │  generateHeader() + format
│ Enrich Response      │
└──────────┬───────────┘
           │
           │  Full formatted summary
           │
           ▼
┌──────────────────────┐
│ bot.sendToSelf()     │  FileHelper().SendText(summary)
│ Send to Self         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ buffer.Clear()       │  Clear(roomTopic) - thread-safe
│ Clear Buffer         │
└──────────────────────┘
           │
           ▼
      Summary Sent!
```

---

## Component Responsibilities

### bot/bot.go (Main Orchestrator)

**Responsibilities**:
- Initialize openwechat bot instance
- Handle lifecycle events (login, logout)
- Process incoming messages via MessageHandler
- Filter rooms and messages
- Coordinate summary generation
- Manage interval timer with goroutines
- Support hot login with persistent storage

**Key Methods**:
- `Start()`: Initialize and start bot with hot login support
- `handleMessage()`: Process each message (registered as MessageHandler)
- `isTargetRoom()`: Room filtering logic
- `checkKeywordTrigger()`: Keyword detection
- `generateAndSendSummary()`: Orchestrate summary flow (runs in goroutine)
- `startIntervalTimer()`: Setup time-based trigger with ticker and select
- `sendToSelf()`: Send message to FileHelper (self)

---

### buffer/buffer.go (Storage & Triggers)

**Responsibilities**:
- Store messages in memory (per-room maps)
- Implement trigger logic (time/volume/keyword)
- Maintain buffer size limits
- Provide statistics
- Format messages for LLM
- Thread-safe operations with RWMutex

**Key Methods**:
- `Add()`: Add message to buffer (thread-safe with Lock)
- `ShouldSummarize()`: Check all trigger conditions (thread-safe with RLock)
- `FormatMessagesForLLM()`: Prepare for API call
- `GetStats()`: Return statistics
- `Clear()`: Reset buffer after summary
- `GetRoomTopics()`: Get all tracked room topics

**State**:
- `messagesByRoom map[string][]BufferedMessage` - Per-room storage
- `lastSummaryTime map[string]time.Time` - Track time trigger per room
- `mu sync.RWMutex` - Thread-safe access

---

### llm/service.go (API Integration)

**Responsibilities**:
- Communicate with LLM API using go-openai SDK
- Build prompts for meeting minutes
- Handle API errors
- Parse API responses

**Key Methods**:
- `GenerateSummary()`: Build prompt and call LLM API

**Error Handling**:
- Network timeouts
- API authentication errors
- Invalid response formats
- Returns error for upstream handling

---

### summary/generator.go (Formatting)

**Responsibilities**:
- Coordinate summary generation
- Add header (date, time, statistics)
- Add footer (statistics)
- Handle edge cases (no messages)

**Key Methods**:
- `Generate()`: Main entry point
- `generateHeader()`: Create header with date/time in Chinese format

---

### config/config.go (Configuration)

**Responsibilities**:
- Load environment variables using godotenv
- Validate required settings
- Provide global config struct
- Display startup configuration

**Key Functions**:
- `Load()`: Load .env file and parse environment variables
- `Validate()`: Validate and display config
- `getEnv()`: String environment variables
- `getEnvInt()`: Integer environment variables

**Global State**:
- `AppConfig *Config` - Global configuration singleton

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

## Concurrency & Thread Safety

### Go-Specific Features

**Goroutines**:
- Summary generation runs in goroutines (non-blocking)
- Interval timer runs in dedicated goroutine with select/ticker pattern
- Signal handling in separate goroutine

**Thread Safety**:
- `MessageBuffer` uses `sync.RWMutex` for concurrent access
- Read operations use `RLock()` (multiple readers)
- Write operations use `Lock()` (exclusive access)

**Channels**:
- `stopTimer chan bool` for graceful timer shutdown
- Signal channel for SIGINT/SIGTERM handling

## Scalability Considerations

### Current Limitations

1. **Single Instance**: One bot = one WeChat account
2. **In-Memory Buffer**: Lost on restart (hot login session persists)
3. **Per-Room Buffers**: Independent buffers for each room
4. **No Persistence**: Messages not persisted to database

### Potential Improvements

```
Current Architecture (Go):
┌──────────────┐
│   Bot        │ ──► In-memory buffer (thread-safe)
│   Instance   │ ──► Hot login (storage.json)
│  (compiled)  │ ──► Per-room buffers
└──────────────┘

Future Architecture:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Bot        │ ──► │   Redis      │ ──► │  PostgreSQL  │
│   Instance   │     │   (Buffer)   │     │  (History)   │
│  (Go binary) │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
        │
        ├─► Distributed per-room buffers
        ├─► Redis locks for concurrency
        └─► Horizontal scaling with load balancer
```

---

## Performance Characteristics

### Time Complexity

- `Add()`: O(1) with mutex lock
- `ShouldSummarize()`: O(1) with read lock
- `FormatMessagesForLLM()`: O(n) where n = buffer size
- `GenerateSummary()`: O(n) + API latency

### Space Complexity

- Buffer per room: O(n) where n = MAX_BUFFER_SIZE (default: 200)
- Each message: ~100-500 bytes
- Total memory: < 1MB per room
- Go binary: ~10-15MB compiled size

### Latency

- Message processing: < 5ms (Go is faster than Node.js)
- LLM API call: 2-10 seconds (network + generation)
- Total summary generation: 2-10 seconds
- Goroutine overhead: negligible

---

## Deployment Topologies

### Development

```
┌──────────────────────────┐
│  Developer Machine       │
│  ┌────────────────────┐  │
│  │  go run main.go    │  │
│  │  or                │  │
│  │  ./wechat-meeting- │  │
│  │      scribe        │  │
│  └────────────────────┘  │
│           │              │
│           ▼              │
│  ┌────────────────────┐  │
│  │  WeChat Login      │  │
│  │  (QR code URL)     │  │
│  │  storage.json      │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Production (Simple)

```
┌──────────────────────────┐
│  Server (VPS/Cloud)      │
│  ┌────────────────────┐  │
│  │  Go binary         │  │
│  │  (single file)     │  │
│  └────────────────────┘  │
│           │              │
│           ▼              │
│  ┌────────────────────┐  │
│  │  systemd service   │  │
│  │  (auto-restart)    │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Production (Advanced)

```
┌────────────────────────────────────┐
│  Docker Container (scratch/alpine) │
│  ┌──────────────────────────────┐  │
│  │  Go binary (~15MB)           │  │
│  │  No runtime dependencies     │  │
│  └──────────────────────────────┘  │
│           │                        │
│           ▼                        │
│  ┌──────────────────────────────┐  │
│  │  Mounted Volumes             │  │
│  │  - .env (secrets)            │  │
│  │  - storage.json (session)    │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────┐
│  Orchestration (k8s/docker-compose)│
│  Much smaller images vs Node.js    │
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

## Key Differences from TypeScript Version

### Advantages

1. **Performance**: Go is compiled, faster message processing
2. **Concurrency**: Native goroutines for parallel operations
3. **Deployment**: Single binary, no runtime dependencies
4. **Memory**: More efficient memory usage with explicit types
5. **Thread Safety**: Built-in sync primitives (RWMutex)
6. **Login Reliability**: openwechat bypasses WeChat web restrictions

### Migration Notes

- TypeScript async/await → Go goroutines + channels
- JavaScript Promises → Go error returns
- Node.js event emitters → Go function callbacks
- npm packages → Go modules
- Wechaty (account blocked) → openwechat (works)

---

This architecture is designed for simplicity, reliability, and extensibility. It can handle typical use cases (1-10 groups, <100 messages/minute) efficiently while remaining easy to understand and modify. The Go implementation provides better performance and deployment characteristics compared to the Node.js version.

---

**Last Updated**: 2025-10-27
**Version**: 2.0.0 (Go rewrite)
**Previous Version**: 1.0.0 (TypeScript/Node.js)
