import { BufferedMessage, SummaryTriggerConfig } from './types.js'
import { config } from './config.js'

export class MessageBuffer {
  private messagesByRoom: Map<string, BufferedMessage[]> = new Map()
  private lastSummaryTime: Map<string, Date> = new Map()
  private triggerConfig: SummaryTriggerConfig

  constructor() {
    this.triggerConfig = config.summaryTrigger
  }

  add(message: BufferedMessage): void {
    const { roomTopic } = message
    if (!this.messagesByRoom.has(roomTopic)) {
      this.messagesByRoom.set(roomTopic, [])
    }

    const roomMessages = this.messagesByRoom.get(roomTopic)!
    roomMessages.push(message)
    console.log(`[DEBUG] Buffer state for room '${roomTopic}':`, this.getStats(roomTopic))


    if (roomMessages.length > config.maxBufferSize) {
      const removeCount = roomMessages.length - config.maxBufferSize
      roomMessages.splice(0, removeCount)
      console.log(`[Buffer] Removed ${removeCount} old messages from room '${roomTopic}' (max size: ${config.maxBufferSize})`)
    }

    console.log(`[Buffer] Message added to room '${roomTopic}'. Total: ${roomMessages.length}`)
  }

  getMessages(roomTopic: string): BufferedMessage[] {
    return [...(this.messagesByRoom.get(roomTopic) || [])]
  }

  getRoomTopics(): string[] {
    return Array.from(this.messagesByRoom.keys())
  }

  clear(roomTopic: string): void {
    const roomMessages = this.messagesByRoom.get(roomTopic)
    if (roomMessages) {
      const count = roomMessages.length
      this.messagesByRoom.set(roomTopic, [])
      this.lastSummaryTime.set(roomTopic, new Date())
      console.log(`[Buffer] Cleared ${count} messages from room '${roomTopic}'`)
    }
  }

  shouldSummarize(roomTopic: string, triggeredByKeyword: boolean = false): boolean {
    const roomMessages = this.messagesByRoom.get(roomTopic) || []
    if (roomMessages.length < this.triggerConfig.minMessagesForSummary) {
      console.log(`[Buffer] Not enough messages in room '${roomTopic}' for summary (${roomMessages.length}/${this.triggerConfig.minMessagesForSummary})`)
      return false
    }

    if (triggeredByKeyword) {
      console.log(`[Buffer] Summary triggered by keyword in room '${roomTopic}'`)
      return true
    }

    if (this.triggerConfig.messageCount > 0 && roomMessages.length >= this.triggerConfig.messageCount) {
      console.log(`[Buffer] Summary triggered by message count in room '${roomTopic}' (${roomMessages.length}/${this.triggerConfig.messageCount})`)
      return true
    }

    const lastSummary = this.lastSummaryTime.get(roomTopic)
    if (this.triggerConfig.intervalMinutes > 0 && lastSummary) {
      const minutesSinceLastSummary = (Date.now() - lastSummary.getTime()) / (1000 * 60)
      if (minutesSinceLastSummary >= this.triggerConfig.intervalMinutes) {
        console.log(`[Buffer] Summary triggered by time interval in room '${roomTopic}' (${minutesSinceLastSummary.toFixed(1)}/${this.triggerConfig.intervalMinutes} minutes)`)
        return true
      }
    }

    return false
  }

  formatMessagesForLLM(roomTopic: string): string[] {
    const roomMessages = this.messagesByRoom.get(roomTopic) || []
    return roomMessages.map(msg => {
      const time = msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      return `[${time}] ${msg.sender}: ${msg.content}`
    })
  }

  getStats(roomTopic: string): { count: number; firstMessage: Date | null; lastMessage: Date | null; participants: Set<string> } {
    const roomMessages = this.messagesByRoom.get(roomTopic) || []
    const participants = new Set(roomMessages.map(m => m.sender))
    return {
      count: roomMessages.length,
      firstMessage: roomMessages.length > 0 ? roomMessages[0].timestamp : null,
      lastMessage: roomMessages.length > 0 ? roomMessages[roomMessages.length - 1].timestamp : null,
      participants
    }
  }
}
