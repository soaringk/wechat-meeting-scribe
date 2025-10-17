import { LLMService } from './llm-service.js'
import { MessageBuffer } from './message-buffer.js'

export class SummaryGenerator {
  private llmService: LLMService

  constructor() {
    this.llmService = new LLMService()
  }

  async generate(buffer: MessageBuffer, roomTopic: string): Promise<string> {
    const stats = buffer.getStats(roomTopic)

    if (stats.count === 0) {
      return `群组「${roomTopic}」暂无新消息需要总结。`
    }

    console.log(`[Summary] Generating summary for ${stats.count} messages in room '${roomTopic}'...`)
    console.log(`[Summary] Participants: ${stats.participants.size}`)
    console.log(`[Summary] Time range: ${stats.firstMessage?.toLocaleString('zh-CN')} - ${stats.lastMessage?.toLocaleString('zh-CN')}`)

    try {
      const formattedMessages = buffer.formatMessagesForLLM(roomTopic)
      const summary = await this.llmService.generateSummary(formattedMessages)

      const header = this.generateHeader(stats, roomTopic)
      const fullSummary = `${header}\n\n${summary}\n\n---\n📊 统计信息：共 ${stats.count} 条消息，${stats.participants.size} 位参与者`

      console.log(`[Summary] Summary generated successfully for room '${roomTopic}' (${fullSummary.length} chars)`)
      return fullSummary
    } catch (error) {
      console.error(`[Summary] Error generating summary for room '${roomTopic}':`, error)
      return `❌ 为「${roomTopic}」生成纪要时出错：${error instanceof Error ? error.message : '未知错误'}`
    }
  }

  private generateHeader(stats: { count: number; firstMessage: Date | null; lastMessage: Date | null }, roomTopic: string): string {
    const now = new Date()
    const dateStr = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })

    let timeRange = ''
    if (stats.firstMessage && stats.lastMessage) {
      const start = stats.firstMessage.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      const end = stats.lastMessage.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      timeRange = `${start} - ${end}`
    }

    return `# 🤖 ${roomTopic} 会议纪要\n📅 日期：${dateStr}\n⏰ 时间：${timeRange}\n`
  }
}
