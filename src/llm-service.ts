import OpenAI from 'openai'
import { config } from './config.js'
import { LLMMessage, LLMResponse } from './types.js'

export class LLMService {
  private client: OpenAI
  private model: string

  constructor() {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl
    })
    this.model = config.llmModel
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      console.log(`[LLM] Sending request to ${this.model}...`)
      console.debug('[DEBUG] LLM Request:', messages)

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.log('[LLM] No content in response')
        return { content: '' }
      }

      console.log(`[LLM] Response received (${content.length} chars)`)
      return { content }
    } catch (error) {
      console.error('[LLM] Error:', error)
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async generateSummary(messages: string[]): Promise<string> {
    const systemPrompt = `你是一个专业的助理，擅长提供高信噪比的信息。你的任务是根据大量原始的群聊消息生成简洁的消息总结。我的具体要求：
- 输出内容结构化，包括：关键讨论点、事件进展、待办事项等
- 突出重要信息，省略冗余内容，尽量不超过100字
- 保持客观中立，不添加个人观点
- 使用中文输出`

    const conversationText = messages.join('\n')

    const llmMessages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `请为以下群聊消息生成会议纪要：\n\n${conversationText}`
      }
    ]

    const response = await this.chat(llmMessages)

    if (response.error) {
      throw new Error(`LLM service error: ${response.error}`)
    }

    return response.content
  }
}
