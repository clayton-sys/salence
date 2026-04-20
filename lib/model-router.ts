// THE ONLY FILE THAT KNOWS ABOUT AI MODELS
// Swap provider/model here — nothing else changes.
// To use Ollama:  { provider: 'ollama', model: 'llama3.1:8b' }
// To use OpenAI:  { provider: 'openai', model: 'gpt-4o-mini' }

type Provider = 'anthropic' | 'ollama' | 'openai'

interface TierConfig {
  provider: Provider
  model: string
  maxTokens: number
  temperature: number
  baseUrl?: string
}

export const MODEL_CONFIG: Record<'grunt' | 'reason', TierConfig> = {
  grunt: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 512,
    temperature: 0,
  },
  reason: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    temperature: 0.7,
  },
}

export const TASK_TIER = {
  classify: 'grunt',
  compress: 'grunt',
  contradiction_check: 'grunt',
  decay_check: 'grunt',
  extract_facts: 'grunt',
  domain_detect: 'grunt',
  chat: 'reason',
  synthesize: 'reason',
  weekly_digest: 'reason',
} as const

export type TaskType = keyof typeof TASK_TIER

export async function modelCall({
  taskType,
  systemPrompt,
  userMessage,
  apiKey,
}: {
  taskType: TaskType
  systemPrompt: string
  userMessage: string
  apiKey: string
}): Promise<string> {
  const tier = TASK_TIER[taskType]
  const config = MODEL_CONFIG[tier]

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.content?.[0]?.text || ''
  }

  if (config.provider === 'ollama') {
    const baseUrl = config.baseUrl || 'http://localhost:11434'
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: `${systemPrompt}\n\nUser: ${userMessage}`,
        stream: false,
      }),
    })
    const data = await res.json()
    return data.response || ''
  }

  throw new Error(`Unknown provider: ${config.provider}`)
}
