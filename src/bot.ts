import { WechatyBuilder, Message, Contact } from 'wechaty'
import { config, validateConfig } from './config.js'
import { MessageBuffer } from './message-buffer.js'
import { SummaryGenerator } from './summary-generator.js'
import { BufferedMessage } from './types.js'

class MeetingMinutesBot {
  private bot
  private buffer: MessageBuffer
  private generator: SummaryGenerator
  private intervalTimer: NodeJS.Timeout | null = null

  constructor() {
    console.log('🤖 Initializing WeChat Meeting Scribe...\n')

    validateConfig()

    this.buffer = new MessageBuffer()
    this.generator = new SummaryGenerator()

    this.bot = WechatyBuilder.build({
      name: config.botName,
      puppet: 'wechaty-puppet-wechat',
      puppetOptions: {
        uos: config.puppetUosEnabled,
        launchOptions: {
          headless: config.puppetHeadless
        }
      }
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.bot
      .on('scan', this.onScan.bind(this))
      .on('login', this.onLogin.bind(this))
      .on('logout', this.onLogout.bind(this))
      .on('message', this.onMessage.bind(this))
      .on('error', this.onError.bind(this))
  }

  private onScan(qrcode: string, status: number): void {
    console.log(`\n📱 Scan QR Code to login:`)
    console.log(`   Status: ${status}`)
    console.log(`   URL: https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`)
    console.log(`\n   Please scan the QR code with WeChat to login.\n`)
  }

  private async onLogin(user: Contact): Promise<void> {
    console.log(`\n✅ User ${user} logged in successfully!`)
    console.log(`   Bot is now active and monitoring messages.\n`)

    if (config.summaryTrigger.intervalMinutes > 0) {
      this.startIntervalTimer()
    }
  }

  private onLogout(user: Contact): void {
    console.log(`\n👋 User ${user} logged out`)
    this.stopIntervalTimer()
  }

  private onError(error: Error): void {
    console.error('❌ Bot error:', error)
  }

  private async onMessage(message: Message): Promise<void> {
    try {
      if (message.self()) {
        return
      }

      const room = message.room()
      if (!room) {
        return
      }

      const topic = await room.topic()
      const talker = message.talker()
      const text = message.text()

      if (!text || text.trim().length === 0) {
        return
      }

      if (!this.isTargetRoom(topic)) {
        return
      }

      const bufferedMessage: BufferedMessage = {
        id: message.id,
        timestamp: message.date(),
        sender: talker.name(),
        content: text,
        roomTopic: topic
      }

      this.buffer.add(bufferedMessage)

      const isKeywordTrigger = this.checkKeywordTrigger(text)

      if (this.buffer.shouldSummarize(isKeywordTrigger)) {
        await this.generateAndSendSummary(room)
      }
    } catch (error) {
      console.error('Error processing message:', error)
    }
  }

  private isTargetRoom(roomTopic: string): boolean {
    if (config.targetRooms.length === 0) {
      return true
    }

    return config.targetRooms.some(target =>
      roomTopic.toLowerCase().includes(target.toLowerCase())
    )
  }

  private checkKeywordTrigger(text: string): boolean {
    if (!config.summaryTrigger.keyword) {
      return false
    }

    return text.includes(config.summaryTrigger.keyword)
  }

  private async generateAndSendSummary(room: any): Promise<void> {
    try {
      console.log('\n📝 Generating summary...')

      const summary = await this.generator.generate(this.buffer)

      console.log('📤 Sending summary to room...')
      await room.say(summary)

      this.buffer.clear()

      console.log('✅ Summary sent successfully!\n')
    } catch (error) {
      console.error('❌ Error generating/sending summary:', error)

      try {
        await room.say(`生成会议纪要时出错，请稍后重试。错误：${error instanceof Error ? error.message : '未知错误'}`)
      } catch (sendError) {
        console.error('Failed to send error message:', sendError)
      }
    }
  }

  private startIntervalTimer(): void {
    const intervalMs = config.summaryTrigger.intervalMinutes * 60 * 1000

    console.log(`⏱️  Starting interval timer (${config.summaryTrigger.intervalMinutes} minutes)`)

    this.intervalTimer = setInterval(() => {
      console.log('\n⏰ Interval timer triggered')

      if (this.buffer.shouldSummarize(false)) {
        const messages = this.buffer.getMessages()
        if (messages.length > 0) {
          const roomTopic = messages[0].roomTopic
          console.log(`Processing scheduled summary for room: ${roomTopic}`)
        }
      }
    }, intervalMs)
  }

  private stopIntervalTimer(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
      console.log('⏱️  Interval timer stopped')
    }
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting bot...\n')
      await this.bot.start()
    } catch (error) {
      console.error('Failed to start bot:', error)
      process.exit(1)
    }
  }

  async stop(): Promise<void> {
    this.stopIntervalTimer()
    await this.bot.stop()
    console.log('\n🛑 Bot stopped')
  }
}

const bot = new MeetingMinutesBot()

bot.start().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received SIGINT, shutting down gracefully...')
  await bot.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...')
  await bot.stop()
  process.exit(0)
})
