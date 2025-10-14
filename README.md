# 🤖 WeChat Meeting Scribe

**Your AI Meeting Secretary for WeChat Groups**

A real-time WeChat bot that automatically tracks and summarizes group discussions, generating structured meeting minutes using AI.

## ✨ Features

- **Real-time Monitoring**: Automatically tracks messages in specified WeChat groups
- **Smart Summarization**: Uses LLM to generate structured meeting minutes
- **Multiple Triggers**: Supports time-based, volume-based, and keyword triggers
- **Flexible Configuration**: Easy to customize via environment variables
- **UOS Support**: Works with modern WeChat accounts (bypasses 2017+ login restrictions)

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

- Node.js 16+
- NPM 7+
- WeChat account (must be able to login to web WeChat)
- LLM API access (currently configured for Alibaba DeepSeek API)

### Installation

1. **Clone or download this project**

```bash
cd wechat-meeting-scribe
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# LLM API Configuration
LLM_API_URL=https://whale-wave.alibaba-inc.com/api/v2/services/aigc/text-generation/chat/completions
LLM_API_KEY=your_api_key_here
LLM_MODEL=DeepSeek-V3.2-Exp

# Target rooms (comma-separated, leave empty for all rooms)
TARGET_ROOMS=项目讨论群,技术交流群

# Summarization Triggers
SUMMARY_INTERVAL_MINUTES=30    # Summarize every 30 minutes
SUMMARY_MESSAGE_COUNT=50       # Summarize every 50 messages
SUMMARY_KEYWORD=@bot 总结      # Trigger with keyword

# Minimum messages required for summary
MIN_MESSAGES_FOR_SUMMARY=5

# Wechaty options
PUPPET_UOS_ENABLED=true        # Enable UOS for modern accounts
PUPPET_HEADLESS=false          # Set to true for production (no browser UI)
```

### Running the Bot

**Development mode** (with auto-reload):

```bash
npm run dev
```

**Production mode**:

```bash
npm run build
npm start
```

### First Time Setup

1. Run the bot: `npm run dev`
2. Scan the QR code with WeChat
3. Wait for login confirmation
4. The bot will start monitoring configured rooms

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
├── src/
│   ├── bot.ts                 # Main bot logic
│   ├── config.ts              # Configuration loader
│   ├── llm-service.ts         # LLM API integration
│   ├── message-buffer.ts      # Message buffering system
│   ├── summary-generator.ts   # Summary generation
│   └── types.ts               # TypeScript type definitions
├── dist/                      # Compiled JavaScript (after build)
├── .env                       # Your configuration (not in git)
├── .env.example               # Configuration template
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

## ⚙️ Configuration Reference

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `LLM_API_URL` | string | (required) | LLM API endpoint |
| `LLM_API_KEY` | string | (required) | API authentication key |
| `LLM_MODEL` | string | DeepSeek-V3.2-Exp | Model name |
| `BOT_NAME` | string | meeting-minutes-bot | Bot instance name |
| `TARGET_ROOMS` | string | (empty) | Comma-separated room names |
| `SUMMARY_INTERVAL_MINUTES` | number | 30 | Time-based trigger (0=disabled) |
| `SUMMARY_MESSAGE_COUNT` | number | 50 | Volume-based trigger (0=disabled) |
| `SUMMARY_KEYWORD` | string | @bot 总结 | Keyword trigger (empty=disabled) |
| `MIN_MESSAGES_FOR_SUMMARY` | number | 5 | Minimum messages to generate summary |
| `MAX_BUFFER_SIZE` | number | 200 | Maximum messages to keep in buffer |
| `PUPPET_UOS_ENABLED` | boolean | true | Enable UOS patch for modern accounts |
| `PUPPET_HEADLESS` | boolean | false | Run browser in headless mode |

### Trigger Strategy

You can enable multiple triggers simultaneously:

- **Only time-based**: Set `SUMMARY_INTERVAL_MINUTES=30`, others to 0
- **Only volume-based**: Set `SUMMARY_MESSAGE_COUNT=50`, others to 0
- **Combined**: Enable both time and volume triggers
- **Always available**: Keyword trigger works regardless of other settings

## 🛠️ Customization

### Modify Summary Prompt

Edit `src/llm-service.ts`, function `generateSummary()`, modify the `systemPrompt`:

```typescript
const systemPrompt = `Your custom prompt here...`
```

### Adjust Message Format

Edit `src/message-buffer.ts`, function `formatMessagesForLLM()`:

```typescript
formatMessagesForLLM(): string[] {
  return this.messages.map(msg => {
    // Customize message format
    return `${msg.sender}: ${msg.content}`
  })
}
```

## 🐛 Troubleshooting

### Login Issues

**Problem**: Cannot scan QR code or login fails

**Solutions**:
- Make sure your WeChat account can login at https://wx.qq.com
- Ensure `PUPPET_UOS_ENABLED=true` in `.env`
- Try with `PUPPET_HEADLESS=false` to see the browser

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

**Problem**: Installation or runtime errors

**Solutions**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# If in China, use mirror for puppeteer
export PUPPETEER_DOWNLOAD_HOST=https://registry.npmmirror.com/mirrors
npm install
```

## 🔒 Security Notes

- **Never commit `.env`**: Contains sensitive API keys
- **API Key Protection**: Keep your LLM API key secure
- **Network Security**: Bot requires network access to LLM API
- **Data Privacy**: Messages are sent to LLM for processing

## 📝 Development

### Build

```bash
npm run build
```

### Clean

```bash
npm run clean
```

### Run Tests

```bash
# TODO: Add tests
npm test
```

## 🤝 Contributing

Issues and pull requests are welcome!

## 📄 License

MIT

## 🙏 Acknowledgments

- [Wechaty](https://github.com/wechaty/wechaty) - Conversational RPA SDK
- [wechaty-puppet-wechat](https://github.com/wechaty/wechaty-puppet-wechat) - WeChat Web Protocol
- DeepSeek - LLM API provider

## 📞 Support

If you encounter issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review console logs for error messages
3. Verify your configuration in `.env`
4. Check Wechaty documentation: https://wechaty.js.org/

---

**Happy Meeting! 🎉**
