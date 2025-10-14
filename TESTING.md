# 🧪 Testing Guide

## Quick Test Checklist

### ✅ Pre-flight Checks

Before starting the bot:

```bash
# 1. Verify configuration
cat .env | grep -E "LLM_API_KEY|TARGET_ROOMS|SUMMARY"

# 2. Check build
npm run build

# 3. Verify dependencies
npm list wechaty wechaty-puppet-wechat axios dotenv
```

---

## 🔬 Test Scenarios

### Test 1: Basic Login

**Goal**: Verify bot can login to WeChat

```bash
npm run dev
```

**Expected**:
1. See QR code URL
2. Scan with WeChat
3. See "User xxx logged in successfully!"

**Troubleshooting**:
- If QR code doesn't appear: Check puppeteer installation
- If login fails: Try `PUPPET_UOS_ENABLED=true`
- If browser crashes: Set `PUPPET_HEADLESS=false`

---

### Test 2: Message Monitoring

**Goal**: Verify bot receives room messages

**Setup**:
```env
TARGET_ROOMS=
MIN_MESSAGES_FOR_SUMMARY=999  # Disable auto-summary
```

**Steps**:
1. Start bot: `npm run dev`
2. Login via QR code
3. Send test message in any group
4. Check console logs

**Expected**:
```
[Buffer] Message added. Total: 1
[Buffer] Message added. Total: 2
...
```

---

### Test 3: Keyword Trigger

**Goal**: Test manual summary generation

**Setup**:
```env
SUMMARY_KEYWORD=@bot 总结
MIN_MESSAGES_FOR_SUMMARY=3
SUMMARY_INTERVAL_MINUTES=0
SUMMARY_MESSAGE_COUNT=0
```

**Steps**:
1. Start bot
2. In target group, send 3+ messages
3. Send trigger: `@bot 总结`

**Expected**:
- Console shows: `[Buffer] Summary triggered by keyword`
- Console shows: `[Summary] Generating summary for X messages...`
- Group receives formatted meeting minutes
- Console shows: `✅ Summary sent successfully!`

---

### Test 4: Volume Trigger

**Goal**: Test automatic volume-based summarization

**Setup**:
```env
SUMMARY_MESSAGE_COUNT=5
MIN_MESSAGES_FOR_SUMMARY=5
SUMMARY_INTERVAL_MINUTES=0
SUMMARY_KEYWORD=
```

**Steps**:
1. Start bot
2. Send 5 messages in target group
3. Wait for automatic summary

**Expected**:
- After 5th message, console shows trigger
- Summary automatically sent to group

---

### Test 5: Time Trigger

**Goal**: Test automatic time-based summarization

**Setup**:
```env
SUMMARY_INTERVAL_MINUTES=1     # Every 1 minute for testing
MIN_MESSAGES_FOR_SUMMARY=2
SUMMARY_MESSAGE_COUNT=0
SUMMARY_KEYWORD=
```

**Steps**:
1. Start bot
2. Send 2+ messages in target group
3. Wait ~1 minute

**Expected**:
- Console shows: `⏰ Interval timer triggered`
- If enough messages: summary generated

**Note**: Remember to change back to realistic interval (30+ minutes) after testing!

---

### Test 6: Room Filtering

**Goal**: Verify TARGET_ROOMS works

**Setup**:
```env
TARGET_ROOMS=测试群
```

**Steps**:
1. Start bot
2. Send messages in "测试群" → should be tracked
3. Send messages in other groups → should be ignored

**Expected**:
- Messages from "测试群" appear in console logs
- Messages from other groups don't appear

---

### Test 7: LLM Integration

**Goal**: Test LLM API connectivity

**Setup**: Use real API key

**Steps**:
1. Configure proper `LLM_API_KEY`
2. Send sample messages
3. Trigger summary

**Expected**:
```
[LLM] Sending request to DeepSeek-V3.2-Exp...
[LLM] Response received (XXX chars)
[Summary] Summary generated successfully (XXX chars)
```

**Error Handling**:
- If API error: Check API key and URL
- If timeout: Check network connectivity
- If format error: Verify API response structure

---

### Test 8: Error Recovery

**Goal**: Test bot handles errors gracefully

**Test Cases**:

1. **Invalid API Key**:
   ```env
   LLM_API_KEY=invalid_key
   ```
   - Expected: Error message sent to group
   - Bot continues running

2. **Network Timeout**:
   - Disconnect network during summary
   - Expected: Error caught and logged
   - Bot doesn't crash

3. **Empty Buffer**:
   - Trigger with 0 messages
   - Expected: "暂无消息需要总结。"

---

## 🔍 Debugging Tips

### Enable Detailed Logging

Add to `src/bot.ts`:

```typescript
private async onMessage(message: Message): Promise<void> {
  console.log('[DEBUG] Message received:', {
    from: message.talker().name(),
    room: message.room() ? await message.room()?.topic() : 'N/A',
    text: message.text(),
    self: message.self()
  })
  // ... rest of code
}
```

### Check Message Buffer State

Add to `src/message-buffer.ts`:

```typescript
add(message: BufferedMessage): void {
  this.messages.push(message)
  console.log('[DEBUG] Buffer state:', this.getStats())
  // ... rest of code
}
```

### Inspect LLM Requests

Add to `src/llm-service.ts`:

```typescript
async chat(messages: LLMMessage[]): Promise<LLMResponse> {
  console.log('[DEBUG] LLM Request:', JSON.stringify(messages, null, 2))
  // ... rest of code
}
```

---

## 📊 Performance Testing

### Message Processing Speed

```typescript
// Add to bot.ts onMessage
const startTime = Date.now()
// ... processing ...
console.log(`Message processed in ${Date.now() - startTime}ms`)
```

### LLM Response Time

Already logged in `llm-service.ts`:
```
[LLM] Sending request...
[LLM] Response received (took X seconds)
```

### Memory Usage

```bash
# Monitor while bot is running
node --expose-gc dist/bot.js

# Or use external tool
ps aux | grep node
```

---

## 🧩 Integration Testing

### Test with Mock LLM

Create `src/mock-llm-service.ts`:

```typescript
export class MockLLMService {
  async generateSummary(messages: string[]): Promise<string> {
    return `
# 🤖 会议纪要 (MOCK)

### 📋 关键讨论点
- Mock point 1
- Mock point 2

---
📊 统计信息：共 ${messages.length} 条消息
    `
  }
}
```

Replace in `bot.ts` for testing without API calls.

---

## 📋 Test Checklist

Before deploying to production:

- [ ] Bot can login successfully
- [ ] Messages are received from target rooms
- [ ] Messages from non-target rooms are ignored
- [ ] Keyword trigger works
- [ ] Volume trigger works (if enabled)
- [ ] Time trigger works (if enabled)
- [ ] LLM API returns valid summaries
- [ ] Summaries are posted to group
- [ ] Buffer clears after summary
- [ ] Error messages are sent to group
- [ ] Bot handles API failures gracefully
- [ ] Bot doesn't crash on logout
- [ ] Ctrl+C shuts down gracefully
- [ ] Build produces valid JavaScript
- [ ] Production mode (`npm start`) works

---

## 🎯 Acceptance Criteria

Bot is ready for production when:

✅ All test scenarios pass
✅ No crashes during 1-hour run
✅ Summaries are accurate and well-formatted
✅ Memory usage is stable
✅ Logs are clear and helpful
✅ Configuration is documented
✅ Error handling is robust

---

## 🐛 Common Issues

### Issue: "Not enough messages for summary"

**Cause**: Buffer has fewer than `MIN_MESSAGES_FOR_SUMMARY`

**Fix**:
- Send more messages, or
- Lower `MIN_MESSAGES_FOR_SUMMARY` in `.env`

### Issue: "Summary triggered by keyword" but no summary sent

**Possible causes**:
1. LLM API error (check API key)
2. Network timeout (check connectivity)
3. Room permissions (bot can't send to room)

**Debug**:
```bash
# Check LLM logs
grep "LLM" logs.txt

# Check error logs
grep "Error" logs.txt
```

### Issue: Bot logs out randomly

**Cause**: WeChat detects bot behavior

**Mitigations**:
- Use `PUPPET_UOS_ENABLED=true`
- Don't spam too many summaries
- Add delays between bot actions
- Use a dedicated WeChat account

---

## 📝 Test Report Template

```markdown
## Test Report

**Date**: 2025-10-14
**Tester**: Your Name
**Environment**: Development

### Test Results

| Test | Status | Notes |
|------|--------|-------|
| Login | ✅ | Successful on first try |
| Message monitoring | ✅ | All messages captured |
| Keyword trigger | ✅ | Works as expected |
| Volume trigger | ⚠️  | Needs 5 messages minimum |
| Time trigger | ✅ | Triggered after 30 mins |
| LLM integration | ✅ | Good quality summaries |
| Error handling | ✅ | Graceful degradation |
| Room filtering | ✅ | Only target rooms tracked |

### Issues Found

1. None

### Recommendations

1. Ready for production use
2. Monitor memory usage over 24 hours

### Sign-off

✅ Approved for production
```

---

Happy Testing! 🚀
