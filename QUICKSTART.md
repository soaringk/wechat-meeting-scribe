# 🚀 Quick Start Guide

**WeChat Meeting Scribe - Your AI Meeting Secretary**

Get your meeting minutes bot running in 5 minutes!

## Step 1: Configure (2 minutes)

Edit `.env` file:

```bash
# 1. Set your API key
LLM_API_KEY=your_api_key_here

# 2. (Optional) Set target rooms
TARGET_ROOMS=项目讨论群,技术交流群

# 3. (Optional) Adjust triggers
SUMMARY_INTERVAL_MINUTES=30      # Every 30 minutes
SUMMARY_MESSAGE_COUNT=50         # Every 50 messages
SUMMARY_KEYWORD=@bot 总结        # Manual trigger
```

**Note**: If you leave `TARGET_ROOMS` empty, the bot will monitor ALL rooms!

## Step 2: Start Bot (1 minute)

```bash
npm run dev
```

## Step 3: Login (1 minute)

1. You'll see a QR code URL in the console
2. Open the URL in your browser
3. Scan with WeChat
4. Wait for "User xxx logged in successfully!"

## Step 4: Test (1 minute)

Go to any monitored WeChat group and send:

```
@bot 总结
```

The bot will generate a summary if there are at least 5 messages in the buffer!

---

## Example Output

When triggered, the bot sends something like:

```
# 🤖 会议纪要
📅 日期：2025年10月14日 星期二
⏰ 时间：10:30 - 11:45

## 会议纪要

### 📋 关键讨论点
- 讨论了新功能的技术方案
- 评估了不同实现方式的优缺点
- 确认了性能优化的必要性

### ✅ 决定事项
- 采用方案A进行开发
- 下周开始编码

### 📌 待办事项
- 张三：完成技术文档
- 李四：准备测试环境

### 👥 主要参与者
- 张三、李四、王五

---
📊 统计信息：共 45 条消息，3 位参与者
```

---

## Tips

### Disable Auto-Triggers

If you only want manual summaries:

```env
SUMMARY_INTERVAL_MINUTES=0
SUMMARY_MESSAGE_COUNT=0
SUMMARY_KEYWORD=@bot 总结
```

### Run in Background (Production)

```bash
# 1. Build
npm run build

# 2. Set headless mode
# Edit .env: PUPPET_HEADLESS=true

# 3. Run with PM2 or screen
pm2 start npm --name "wechat-bot" -- start

# Or with screen
screen -S wechat-bot
npm start
# Press Ctrl+A then D to detach
```

### Monitor Specific Rooms Only

```env
# Exact match not required, partial match works
TARGET_ROOMS=项目,技术,讨论
```

This will match rooms like:
- "项目讨论群"
- "技术交流群"
- "每日讨论"

---

## Troubleshooting

### "Not enough messages for summary"

Make sure you have at least 5 messages (configurable via `MIN_MESSAGES_FOR_SUMMARY`)

### Bot doesn't respond

1. Check if room name matches `TARGET_ROOMS`
2. Verify at least one trigger is enabled (not all set to 0)
3. Check console logs for errors

### Login fails

1. Test if you can login at https://wx.qq.com
2. Ensure `PUPPET_UOS_ENABLED=true` in `.env`
3. Try `PUPPET_HEADLESS=false` to see browser

---

## Next Steps

- Read [README.md](README.md) for full documentation
- Customize the summary prompt in `src/llm-service.ts`
- Adjust message format in `src/message-buffer.ts`

**Need help?** Check the full [README.md](README.md) troubleshooting section!
