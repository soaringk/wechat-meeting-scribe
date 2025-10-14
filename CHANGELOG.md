# Changelog

All notable changes to WeChat Meeting Scribe will be documented in this file.

## [1.0.0] - 2025-10-14

### Project Renamed
- **Renamed** from `auto-chat` to `wechat-meeting-scribe`
- **New tagline**: "Your AI Meeting Secretary for WeChat Groups"
- **Rationale**: Better reflects the core functionality of automated meeting minutes and summarization

### Initial Release

#### Added
- Real-time WeChat group message monitoring
- AI-powered meeting minutes generation using Alibaba DeepSeek API
- Three trigger mechanisms:
  - Time-based (configurable interval)
  - Volume-based (message count threshold)
  - Keyword-based (manual trigger)
- Message buffering system with configurable size limits
- Room filtering (target specific groups or all groups)
- Structured summary format:
  - Key discussion points
  - Decisions made
  - Action items
  - Participants list
  - Statistics
- UOS patch support for modern WeChat accounts (2017+)
- Comprehensive error handling and logging
- Graceful shutdown on SIGINT/SIGTERM
- TypeScript implementation with full type safety
- Environment-based configuration via .env file

#### Documentation
- Complete README with installation and usage guide
- Quick Start guide (5-minute setup)
- Project Summary with technical overview
- Architecture documentation with diagrams
- Testing guide with test scenarios
- Changelog (this file)

#### Configuration Options
- `LLM_API_URL`: LLM service endpoint
- `LLM_API_KEY`: API authentication key
- `LLM_MODEL`: Model selection (default: DeepSeek-V3.2-Exp)
- `BOT_NAME`: Bot instance name (default: wechat-meeting-scribe)
- `TARGET_ROOMS`: Comma-separated room names to monitor
- `SUMMARY_INTERVAL_MINUTES`: Time-based trigger interval
- `SUMMARY_MESSAGE_COUNT`: Volume-based trigger threshold
- `SUMMARY_KEYWORD`: Keyword for manual trigger (default: @bot 总结)
- `MIN_MESSAGES_FOR_SUMMARY`: Minimum messages required (default: 5)
- `MAX_BUFFER_SIZE`: Maximum buffer size (default: 200)
- `PUPPET_UOS_ENABLED`: Enable UOS patch (default: true)
- `PUPPET_HEADLESS`: Run browser in headless mode (default: false)

#### Technical Stack
- Node.js 16+ with ES Modules
- TypeScript 5.3
- Wechaty 1.20+ (conversational RPA SDK)
- wechaty-puppet-wechat 1.18+ (Web protocol with UOS)
- Axios 1.6 (HTTP client)
- dotenv 16.3 (environment variables)

#### Project Structure
```
wechat-meeting-scribe/
├── src/
│   ├── bot.ts                 # Main bot logic (213 lines)
│   ├── config.ts              # Configuration loader (57 lines)
│   ├── llm-service.ts         # LLM API integration (109 lines)
│   ├── message-buffer.ts      # Message buffering (75 lines)
│   ├── summary-generator.ts   # Summary generation (56 lines)
│   └── types.ts               # Type definitions (35 lines)
├── dist/                      # Compiled JavaScript
├── .env                       # Configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── Documentation/
    ├── README.md              # Full documentation
    ├── QUICKSTART.md          # Quick setup guide
    ├── PROJECT_SUMMARY.md     # Project overview
    ├── ARCHITECTURE.md        # Technical details
    ├── TESTING.md             # Testing guide
    └── CHANGELOG.md           # This file
```

### Known Limitations
- Web protocol limitations (cannot create rooms, no work WeChat support)
- Single instance per WeChat account
- In-memory buffer (lost on restart)
- Shared buffer across all monitored rooms
- Text messages only (images/files ignored)

### Future Enhancements (Planned)
- Per-room message buffers
- Persistent storage (database)
- Image OCR support
- Multi-language summaries
- Docker containerization
- Web dashboard
- Health check endpoints
- Metrics and monitoring

---

## Version History

### [1.0.0] - 2025-10-14
- Initial release with complete functionality
- Project renamed from auto-chat to wechat-meeting-scribe

---

**Note**: This project follows [Semantic Versioning](https://semver.org/).

Format based on [Keep a Changelog](https://keepachangelog.com/).
