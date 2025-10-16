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
        timeout: 60000,
        launchOptions: {
          headless: config.puppetHeadless,
          args: [
            '--no-sandbox',                    // 禁用沙箱模式（在某些环境如 Docker 中必需）
            '--disable-setuid-sandbox',        // 禁用 setuid 沙箱
            '--disable-dev-shm-usage',         // 不使用 /dev/shm 共享内存（避免内存不足）
            '--disable-accelerated-2d-canvas', // 禁用 2D canvas 硬件加速
            '--no-first-run',                  // 跳过首次运行向导
            '--no-zygote',                     // 禁用 zygote 进程（减少进程开销）
            '--disable-gpu'                    // 禁用 GPU 硬件加速
          ]
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
      .on('ready', this.onReady.bind(this))
      .on('heartbeat', this.onHeartbeat.bind(this))
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
    console.error('   Error stack:', error.stack)
  }

  private onReady(): void {
    console.log('\n✅ Bot is ready!')
  }

  private onHeartbeat(data: any): void {
    console.log(`💓 Heartbeat: ${new Date().toLocaleTimeString()}`)
  }

  private async onMessage(message: Message): Promise<void> {
    try {
      if (message.self()) {
        return
      }

      const room = message.room()
      const text = message.text()

      if (room) {
        // Group chat message
        const topic = await room.topic()
        const talker = message.talker()

        if (!text || text.trim().length === 0) {
          return
        }

        if (text.trim() === '@bot /list-rooms') {
          await this.listRooms(message)
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
      } else {
        // Direct message
        if (text.trim() === '/list-rooms') {
          await this.listRooms(message)
        }
      }
    } catch (error) {
      console.error('Error processing message:', error)
    }
  }

  private async listRooms(message: Message): Promise<void> {
    console.log('\n🔍 Received command to list rooms')
    const rooms = await this.bot.Room.findAll()
    let response = '📢 Available Rooms:\n\n'
    if (rooms.length > 0) {
      response += rooms
        .map(room => `- Topic: ${room.topic()}\n  ID: ${room.id}`)
        .join('\n\n')
    } else {
      response += 'No rooms found.'
    }
    await message.say(response)
    console.log('✅ Room list sent successfully')
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

      const currentUser = this.bot.currentUser
      if (currentUser) {
        console.log('📤 Forwarding summary to self...')
        await currentUser.say(summary)
      } else {
        console.log('📤 Sending summary to room...')
        await room.say(summary)
      }

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
      console.log('⏳ Initializing puppet...')
      console.log('   Puppet: wechaty-puppet-wechat')
      console.log(`   UOS enabled: ${config.puppetUosEnabled}`)
      console.log(`   Headless: ${config.puppetHeadless}`)
      console.log('')

      await this.bot.start()
      console.log('✅ Bot started successfully!')
    } catch (error) {
      console.error('\n❌ Failed to start bot:', error)
      if (error instanceof Error) {
        console.error('   Message:', error.message)
        console.error('   Stack:', error.stack)
      }
      console.error('\n💡 Troubleshooting tips:')
      console.error('   1. Check if you can login at https://wx.qq.com')
      console.error('   2. Ensure PUPPET_UOS_ENABLED=true in .env')
      console.error('   3. Try setting PUPPET_HEADLESS=false to see browser')
      console.error('   4. Your WeChat account must be verified/real-name authenticated')
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
