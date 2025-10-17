export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  error?: string
}

export interface BufferedMessage {
  id: string
  timestamp: Date
  sender: string
  content: string
  roomTopic: string
}

export interface SummaryTriggerConfig {
  intervalMinutes: number
  messageCount: number
  keyword: string
  minMessagesForSummary: number
}

export interface BotConfig {
  llmApiKey: string
  llmBaseUrl: string
  llmModel: string
  botName: string
  targetRooms: string[]
  summaryTrigger: SummaryTriggerConfig
  maxBufferSize: number
  puppetUosEnabled: boolean
  puppetHeadless: boolean
}
