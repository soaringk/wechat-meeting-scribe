import dotenv from 'dotenv'
import { BotConfig } from './types.js'

dotenv.config()

function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  return value ? parseInt(value, 10) : defaultValue
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

export const config: BotConfig = {
  llmApiKey: getEnv('LLM_API_KEY', ''),
  llmBaseUrl: getEnv('LLM_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/'),
  llmModel: getEnv('LLM_MODEL', 'gemini-2.5-flash'),
  botName: getEnv('BOT_NAME', 'meeting-minutes-bot'),
  targetRooms: getEnv('TARGET_ROOMS')
    .split(',')
    .map(r => r.trim())
    .filter(r => r.length > 0),
  summaryTrigger: {
    intervalMinutes: getEnvNumber('SUMMARY_INTERVAL_MINUTES', 30),
    messageCount: getEnvNumber('SUMMARY_MESSAGE_COUNT', 50),
    keyword: getEnv('SUMMARY_KEYWORD', '@bot 总结'),
    minMessagesForSummary: getEnvNumber('MIN_MESSAGES_FOR_SUMMARY', 5)
  },
  maxBufferSize: getEnvNumber('MAX_BUFFER_SIZE', 200),
  puppetUosEnabled: getEnvBoolean('PUPPET_UOS_ENABLED', true),
  puppetHeadless: getEnvBoolean('PUPPET_HEADLESS', false)
}

export function validateConfig(): void {
  if (!config.llmApiKey) {
    throw new Error('LLM_API_KEY is required')
  }
  console.log('✓ Configuration loaded successfully')
  console.log(`  - Bot name: ${config.botName}`)
  console.log(`  - LLM base URL: ${config.llmBaseUrl}`)
  console.log(`  - LLM model: ${config.llmModel}`)
  console.log(`  - Target rooms: ${config.targetRooms.length > 0 ? config.targetRooms.join(', ') : 'All rooms'}`)
  console.log(`  - Summary triggers:`)
  console.log(`    • Time-based: ${config.summaryTrigger.intervalMinutes > 0 ? `every ${config.summaryTrigger.intervalMinutes} minutes` : 'disabled'}`)
  console.log(`    • Volume-based: ${config.summaryTrigger.messageCount > 0 ? `every ${config.summaryTrigger.messageCount} messages` : 'disabled'}`)
  console.log(`    • Keyword: ${config.summaryTrigger.keyword || 'disabled'}`)
}
