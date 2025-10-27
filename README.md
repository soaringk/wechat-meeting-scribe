# 🤖 WeChat Meeting Scribe

**Your AI Meeting Secretary for WeChat Groups**

A real-time WeChat bot that automatically tracks and summarizes group discussions, generating structured meeting minutes using AI.

## ✨ Features

- **Real-time Monitoring**: Automatically tracks messages in specified WeChat groups
- **Smart Summarization**: Uses LLM to generate structured meeting minutes
- **Multiple Triggers**: Supports time-based, volume-based, and keyword triggers
- **Flexible Configuration**: Easy to customize via environment variables
- **Desktop Mode Support**: Uses openwechat library to bypass WeChat login restrictions
- **Hot Login**: Supports persistent login without repeated QR code scanning
- **Per-Room Buffering**: Independently tracks and summarizes each group chat

## 📋 Summary Format

The bot generates meeting minutes with the following structure:

- **📋 Key Discussion Points**: Main topics and viewpoints
- **✅ Decisions Made**: Consensus reached during the discussion
- **📌 Action Items**: Follow-up tasks (with assignees if mentioned)
- **👥 Main Participants**: Active speakers
- **💡 Other Notes**: Additional important information
- **📊 Statistics**: Message count and participant count

## 🚀 Quick Start

### Prerequisites

- Go 1.20+
- WeChat account
- LLM API access (supports Gemini, OpenAI, or any OpenAI-compatible API)

### Installation

1. **Clone or download this project**

```bash
cd wechat-meeting-scribe
```

2. **Install dependencies**

```bash
go mod download
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# LLM API Configuration
# For Gemini (default)
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=your_gemini_api_key_here
LLM_MODEL=gemini-2.5-flash

# For OpenAI
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_API_KEY=your_openai_api_key_here
# LLM_MODEL=gpt-4o-mini

# For other OpenAI-compatible providers
# LLM_BASE_URL=https://your-provider-url.com/v1
# LLM_API_KEY=your_api_key_here
# LLM_MODEL=your_model_name

# Target rooms (comma-separated, leave empty for all rooms)
TARGET_ROOMS=项目讨论群,技术交流群

# Summarization Triggers
SUMMARY_INTERVAL_MINUTES=30    # Summarize every 30 minutes
SUMMARY_MESSAGE_COUNT=50       # Summarize every 50 messages
SUMMARY_KEYWORD=@bot 总结      # Trigger with keyword

# Minimum messages required for summary
MIN_MESSAGES_FOR_SUMMARY=5
```

### Running the Bot

**Build the application**:

```bash
go build -o wechat-meeting-scribe .
```

**Run the bot**:

```bash
./wechat-meeting-scribe
```

**Or build and run in one step**:

```bash
go run main.go
```

### First Time Setup

1. Run the bot: `./wechat-meeting-scribe`
2. Scan the QR code with WeChat (the URL will be printed in the console)
3. Confirm login on your phone
4. The bot will start monitoring configured rooms
5. On subsequent runs, the bot will use hot login (no need to scan QR code again)

## 📖 Usage

### Automatic Triggers

The bot will automatically generate summaries based on your configuration:

1. **Time-based**: Every N minutes (if enabled)
2. **Volume-based**: Every N messages (if enabled)
3. **Keyword-based**: When someone sends the trigger keyword

### Manual Trigger

In any monitored group, send:

```
@bot 总结
```

The bot will immediately generate a summary of recent messages.

### Target Rooms

- **Monitor specific rooms**: Set `TARGET_ROOMS=Group1,Group2` in `.env`
- **Monitor all rooms**: Leave `TARGET_ROOMS=` empty

## 🏗️ Project Structure

```
wechat-meeting-scribe/
├── main.go                    # Application entry point
├── bot/
│   └── bot.go                 # Main bot logic and openwechat integration
├── buffer/
│   └── buffer.go              # Message buffering system (per-room)
├── config/
│   └── config.go              # Configuration loader
├── llm/
│   └── service.go             # LLM API integration
├── summary/
│   └── generator.go           # Summary generation
├── .env                       # Your configuration (not in git)
├── .env.example               # Configuration template
├── go.mod                     # Go module definition
├── go.sum                     # Dependency checksums
├── storage.json               # Hot login storage (auto-generated)
└── README.md                  # This file
```

## ⚙️ Configuration Reference

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LLM_BASE_URL` | string | Gemini OpenAI endpoint | LLM API base URL |
| `LLM_API_KEY` | string | (required) | API authentication key |
| `LLM_MODEL` | string | gemini-2.5-flash | Model name |
| `BOT_NAME` | string | meeting-minutes-bot | Bot instance name |
| `TARGET_ROOMS` | string | (empty) | Comma-separated room names |
| `SUMMARY_INTERVAL_MINUTES` | number | 30 | Time-based trigger (0=disabled) |
| `SUMMARY_MESSAGE_COUNT` | number | 50 | Volume-based trigger (0=disabled) |
| `SUMMARY_KEYWORD` | string | @bot 总结 | Keyword trigger (empty=disabled) |
| `MIN_MESSAGES_FOR_SUMMARY` | number | 5 | Minimum messages to generate summary |
| `MAX_BUFFER_SIZE` | number | 200 | Maximum messages to keep in buffer |

### Trigger Strategy

You can enable multiple triggers simultaneously:

- **Only time-based**: Set `SUMMARY_INTERVAL_MINUTES=30`, others to 0
- **Only volume-based**: Set `SUMMARY_MESSAGE_COUNT=50`, others to 0
- **Combined**: Enable both time and volume triggers
- **Always available**: Keyword trigger works regardless of other settings

## 🛠️ Customization

### Modify Summary Prompt

Edit `llm/service.go`, function `GenerateSummary()`, modify the `systemPrompt`:

```go
systemPrompt := `Your custom prompt here...`
```

### Adjust Message Format

Edit `buffer/buffer.go`, function `FormatMessagesForLLM()`:

```go
formatted[i] = fmt.Sprintf("[%s] %s: %s", timeStr, msg.Sender, msg.Content)
```

## 🐛 Troubleshooting

### Login Issues

**Problem**: Cannot scan QR code or login fails

**Solutions**:
- Check that your WeChat account is not restricted
- The bot uses Desktop mode by default to bypass web WeChat restrictions
- Look for the QR code URL in the console output
- After first successful login, subsequent logins will use hot login (stored in `storage.json`)

### LLM API Errors

**Problem**: Summary generation fails

**Solutions**:
- Verify `LLM_API_KEY` is correct
- Check network connectivity to the API endpoint
- Review API rate limits and quotas
- Check console logs for detailed error messages

### Bot Not Responding

**Problem**: Bot doesn't generate summaries

**Solutions**:
- Check `TARGET_ROOMS` configuration matches your group names
- Verify message count meets `MIN_MESSAGES_FOR_SUMMARY`
- Ensure at least one trigger is enabled (time/volume/keyword)
- Check console logs for errors

### Dependencies Issues

**Problem**: Installation or build errors

**Solutions**:
```bash
# Clean and rebuild
go clean
go mod tidy
go build -o wechat-meeting-scribe .

# If you have Go module proxy issues, try:
export GOPROXY=https://goproxy.io,direct
go mod download
```

## 🔒 Security Notes

- **Never commit `.env`**: Contains sensitive API keys
- **API Key Protection**: Keep your LLM API key secure
- **Network Security**: Bot requires network access to LLM API
- **Data Privacy**: Messages are sent to LLM for processing

## 📝 Development

### Build

```bash
go build -o wechat-meeting-scribe .
```

### Run with Race Detection

```bash
go run -race main.go
```

### Format Code

```bash
go fmt ./...
```

### Run Tests

```bash
# TODO: Add tests
go test ./...
```

## 🤝 Contributing

Issues and pull requests are welcome!

## 📄 License

MIT

## 🙏 Acknowledgments

- [openwechat](https://github.com/eatmoreapple/openwechat) - Golang WeChat SDK that bypasses login restrictions
- [go-openai](https://github.com/sashabaranov/go-openai) - OpenAI Go library
- Google Gemini - Default LLM provider

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review console logs for error messages
3. Verify your configuration in `.env`
4. Check openwechat documentation: https://openwechat.readthedocs.io/

---

**Happy Meeting! 🎉**
