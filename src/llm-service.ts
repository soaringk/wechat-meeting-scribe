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
    const systemPrompt = `你是一个专业的会议记录助手。你的任务是根据群聊消息生成简洁、结构化的会议纪要。

请按照以下格式输出：

## 会议纪要

### 📋 关键讨论点
- 列出主要讨论的话题和观点

### ✅ 决定事项
- 列出达成的决定或共识

### 📌 待办事项
- 列出需要跟进的行动项（如果有明确的负责人，请标注）

### 👥 主要参与者
- 列出活跃的发言人

### 💡 其他要点
- 其他值得记录的信息

注意：
1. 保持简洁，突出重点
2. 使用中文
3. 如果某个部分没有内容，可以省略
4. 保持客观，不要添加个人观点`

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
