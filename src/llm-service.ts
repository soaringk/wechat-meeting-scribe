import axios, { AxiosError } from 'axios'
import { config } from './config.js'
import { LLMMessage, LLMResponse } from './types.js'

export class LLMService {
  private apiUrl: string
  private apiKey: string
  private model: string

  constructor() {
    this.apiUrl = config.llmApiUrl
    this.apiKey = config.llmApiKey
    this.model = config.llmModel
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      console.log(`[LLM] Sending request to ${this.model}...`)

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: messages
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      )

      if (response.data?.choices?.[0]?.message?.content) {
        const content = response.data.choices[0].message.content
        console.log(`[LLM] Response received (${content.length} chars)`)
        return { content }
      }

      throw new Error('Invalid response format from LLM API')
    } catch (error) {
      console.error('[LLM] Error:', error)

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError
        if (axiosError.response) {
          return {
            content: '',
            error: `API Error: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`
          }
        } else if (axiosError.request) {
          return {
            content: '',
            error: 'Network error: No response from API'
          }
        }
      }

      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async generateSummary(messages: string[]): Promise<string> {
    const conversationText = messages.join('\n')

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
