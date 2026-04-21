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
  agent_run: 'reason',
} as const

export type TaskType = keyof typeof TASK_TIER

export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: string; data: string }
    }
  | {
      type: 'document'
      source: {
        type: 'base64'
        media_type: 'application/pdf'
        data: string
      }
    }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}
export interface TextBlock {
  type: 'text'
  text: string
}
export type AssistantBlock = TextBlock | ToolUseBlock

export interface ModelMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ModelResponse {
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | string
  content: AssistantBlock[]
}

function resolveApiKey(override?: string): string {
  const key = override?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || ''
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set on the server. Add it to .env.local and restart dev server.'
    )
  }
  return key
}

export async function modelCall({
  taskType,
  systemPrompt,
  userMessage,
  content,
  apiKey,
}: {
  taskType: TaskType
  systemPrompt: string
  userMessage?: string
  content?: ContentBlock[]
  apiKey?: string
}): Promise<string> {
  const tier = TASK_TIER[taskType]
  const config = MODEL_CONFIG[tier]

  const messageContent: ContentBlock[] =
    content && content.length > 0
      ? content
      : [{ type: 'text', text: userMessage ?? '' }]

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': resolveApiKey(apiKey),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }],
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.content?.[0]?.text || ''
  }

  if (config.provider === 'ollama') {
    const baseUrl = config.baseUrl || 'http://localhost:11434'
    const textOnly =
      userMessage ??
      messageContent
        .map((b) =>
          b.type === 'text'
            ? b.text
            : b.type === 'image'
              ? '[image attachment]'
              : b.type === 'document'
                ? '[pdf attachment]'
                : ''
        )
        .join('\n\n')
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: `${systemPrompt}\n\nUser: ${textOnly}`,
        stream: false,
      }),
    })
    const data = await res.json()
    return data.response || ''
  }

  throw new Error(`Unknown provider: ${config.provider}`)
}

// Full-response call that preserves tool_use blocks. Required for card rendering
// and tool-use loops (agents). Returns the raw Anthropic response shape.
export async function modelCallFull({
  taskType,
  systemPrompt,
  messages,
  tools,
  maxTokens,
  apiKey,
}: {
  taskType: TaskType
  systemPrompt: string
  messages: ModelMessage[]
  tools?: ToolDefinition[]
  maxTokens?: number
  apiKey?: string
}): Promise<ModelResponse> {
  const tier = TASK_TIER[taskType]
  const config = MODEL_CONFIG[tier]

  if (config.provider !== 'anthropic') {
    throw new Error(`modelCallFull only supports anthropic (got ${config.provider})`)
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': resolveApiKey(apiKey),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens ?? config.maxTokens,
      system: systemPrompt,
      messages,
      ...(tools && tools.length ? { tools } : {}),
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return {
    stop_reason: data.stop_reason,
    content: (data.content as AssistantBlock[]) || [],
  }
}
