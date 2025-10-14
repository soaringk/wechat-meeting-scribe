import { BufferedMessage, SummaryTriggerConfig } from './types.js'
import { config } from './config.js'

export class MessageBuffer {
  private messages: BufferedMessage[] = []
  private lastSummaryTime: Date | null = null
  private triggerConfig: SummaryTriggerConfig

  constructor() {
    this.triggerConfig = config.summaryTrigger
  }

  add(message: BufferedMessage): void {
    this.messages.push(message)

    if (this.messages.length > config.maxBufferSize) {
      const removeCount = this.messages.length - config.maxBufferSize
      this.messages.splice(0, removeCount)
      console.log(`[Buffer] Removed ${removeCount} old messages (max size: ${config.maxBufferSize})`)
    }

    console.log(`[Buffer] Message added. Total: ${this.messages.length}`)
  }

  getMessages(): BufferedMessage[] {
    return [...this.messages]
  }

  clear(): void {
    const count = this.messages.length
    this.messages = []
    this.lastSummaryTime = new Date()
    console.log(`[Buffer] Cleared ${count} messages`)
  }

  shouldSummarize(triggeredByKeyword: boolean = false): boolean {
    if (this.messages.length < this.triggerConfig.minMessagesForSummary) {
      console.log(`[Buffer] Not enough messages for summary (${this.messages.length}/${this.triggerConfig.minMessagesForSummary})`)
      return false
    }

    if (triggeredByKeyword) {
      console.log('[Buffer] Summary triggered by keyword')
      return true
    }

    if (this.triggerConfig.messageCount > 0 && this.messages.length >= this.triggerConfig.messageCount) {
      console.log(`[Buffer] Summary triggered by message count (${this.messages.length}/${this.triggerConfig.messageCount})`)
      return true
    }

    if (this.triggerConfig.intervalMinutes > 0 && this.lastSummaryTime) {
      const minutesSinceLastSummary = (Date.now() - this.lastSummaryTime.getTime()) / (1000 * 60)
      if (minutesSinceLastSummary >= this.triggerConfig.intervalMinutes) {
        console.log(`[Buffer] Summary triggered by time interval (${minutesSinceLastSummary.toFixed(1)}/${this.triggerConfig.intervalMinutes} minutes)`)
        return true
      }
    }

    return false
  }

  formatMessagesForLLM(): string[] {
    return this.messages.map(msg => {
      const time = msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      return `[${time}] ${msg.sender}: ${msg.content}`
    })
  }

  getStats(): { count: number; firstMessage: Date | null; lastMessage: Date | null; participants: Set<string> } {
    const participants = new Set(this.messages.map(m => m.sender))
    return {
      count: this.messages.length,
      firstMessage: this.messages.length > 0 ? this.messages[0].timestamp : null,
      lastMessage: this.messages.length > 0 ? this.messages[this.messages.length - 1].timestamp : null,
      participants
    }
  }
}
