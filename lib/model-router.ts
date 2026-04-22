// THE ONLY FILE THAT KNOWS ABOUT AI MODELS
// Swap provider/model here — nothing else changes.

import type { SupabaseClient } from '@supabase/supabase-js'

type Provider = 'anthropic' | 'ollama' | 'openai'
export type ModelTier = 'haiku' | 'sonnet'

interface TierConfig {
  provider: Provider
  model: string
  maxTokens: number
  temperature: number
  baseUrl?: string
  /** Per-million-token pricing in USD. */
  pricePerMTokenIn: number
  pricePerMTokenOut: number
}

export const MODEL_CONFIG: Record<ModelTier, TierConfig> = {
  haiku: {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    temperature: 0,
    pricePerMTokenIn: 1.0,
    pricePerMTokenOut: 5.0,
  },
  sonnet: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    temperature: 0.7,
    pricePerMTokenIn: 3.0,
    pricePerMTokenOut: 15.0,
  },
}

// ────── Intents ─────────────────────────────────────────────
// Callers declare an intent; the router maps it to a tier. Haiku for cheap
// structured work, Sonnet for reasoning and composition.

export type TaskIntent =
  // Haiku — structured, narrow, cheap
  | 'extract'
  | 'categorize'
  | 'patch'
  | 'summarize_short'
  | 'tag'
  | 'quick_reply'
  // Sonnet — reasoning, generation, composition
  | 'plan'
  | 'generate_artifact'
  | 'compose'
  | 'configure_agent'

const INTENT_TIER: Record<TaskIntent, ModelTier> = {
  extract: 'haiku',
  categorize: 'haiku',
  patch: 'haiku',
  summarize_short: 'haiku',
  tag: 'haiku',
  quick_reply: 'haiku',
  plan: 'sonnet',
  generate_artifact: 'sonnet',
  compose: 'sonnet',
  configure_agent: 'sonnet',
}

// ────── Legacy TaskType — kept for existing call sites ──────

export const TASK_TIER = {
  classify: 'haiku',
  compress: 'haiku',
  contradiction_check: 'haiku',
  decay_check: 'haiku',
  extract_facts: 'haiku',
  domain_detect: 'haiku',
  chat: 'sonnet',
  synthesize: 'sonnet',
  weekly_digest: 'sonnet',
  agent_run: 'sonnet',
} as const

export type LegacyTaskType = keyof typeof TASK_TIER
export type TaskType = LegacyTaskType | TaskIntent

function resolveTier(task: TaskType): ModelTier {
  if (task in INTENT_TIER) return INTENT_TIER[task as TaskIntent]
  if (task in TASK_TIER) return TASK_TIER[task as LegacyTaskType] as ModelTier
  return 'sonnet'
}

export function modelFor(
  intent: TaskType
): { model: string; tier: ModelTier } {
  const tier = resolveTier(intent)
  return { model: MODEL_CONFIG[tier].model, tier }
}

// ────── Types ───────────────────────────────────────────────

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

export interface ModelUsage {
  input_tokens: number
  output_tokens: number
}

export interface ModelResponse {
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | string
  content: AssistantBlock[]
  usage?: ModelUsage
}

export interface LogContext {
  supabase: SupabaseClient
  userId: string
  agentId?: string | null
  escalatedFrom?: ModelTier | null
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

function estimateCost(
  tier: ModelTier,
  usage: ModelUsage | undefined
): number {
  if (!usage) return 0
  const cfg = MODEL_CONFIG[tier]
  const inCost = (usage.input_tokens / 1_000_000) * cfg.pricePerMTokenIn
  const outCost = (usage.output_tokens / 1_000_000) * cfg.pricePerMTokenOut
  return Number((inCost + outCost).toFixed(6))
}

// Fire-and-forget — logging failures must not break model calls.
async function logModelCall(
  log: LogContext | undefined,
  intent: TaskType,
  tier: ModelTier,
  model: string,
  usage: ModelUsage | undefined
): Promise<void> {
  if (!log) return
  try {
    await log.supabase.from('model_calls').insert({
      user_id: log.userId,
      intent,
      model,
      tier,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
      cost_usd: estimateCost(tier, usage),
      escalated_from: log.escalatedFrom ?? null,
      agent_id: log.agentId ?? null,
    })
  } catch {
    /* non-blocking */
  }
}

// ────── modelCall (text-only) ───────────────────────────────

export async function modelCall({
  taskType,
  systemPrompt,
  userMessage,
  content,
  apiKey,
  logContext,
}: {
  taskType: TaskType
  systemPrompt: string
  userMessage?: string
  content?: ContentBlock[]
  apiKey?: string
  logContext?: LogContext
}): Promise<string> {
  const tier = resolveTier(taskType)
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
    await logModelCall(logContext, taskType, tier, config.model, data.usage)
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

// ────── modelCallFull (preserves tool_use blocks) ───────────

export async function modelCallFull({
  taskType,
  systemPrompt,
  messages,
  tools,
  maxTokens,
  apiKey,
  logContext,
}: {
  taskType: TaskType
  systemPrompt: string
  messages: ModelMessage[]
  tools?: ToolDefinition[]
  maxTokens?: number
  apiKey?: string
  logContext?: LogContext
}): Promise<ModelResponse> {
  const tier = resolveTier(taskType)
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
  const usage: ModelUsage | undefined = data.usage
    ? {
        input_tokens: data.usage.input_tokens || 0,
        output_tokens: data.usage.output_tokens || 0,
      }
    : undefined
  await logModelCall(logContext, taskType, tier, config.model, usage)
  return {
    stop_reason: data.stop_reason,
    content: (data.content as AssistantBlock[]) || [],
    usage,
  }
}

// ────── Escalation wrapper ──────────────────────────────────
// Run a Haiku-tier intent, validate the response. If validation fails and
// the intent is Haiku tier, retry once with Sonnet. Both calls are logged.

export async function modelCallWithEscalation<T>({
  intent,
  systemPrompt,
  userMessage,
  content,
  validate,
  logContext,
  apiKey,
}: {
  intent: TaskIntent
  systemPrompt: string
  userMessage?: string
  content?: ContentBlock[]
  /** Returns null/undefined when the response is invalid. */
  validate: (raw: string) => T | null | undefined
  logContext?: LogContext
  apiKey?: string
}): Promise<{ value: T; escalated: boolean; raw: string }> {
  const firstTier = resolveTier(intent)
  const first = await modelCall({
    taskType: intent,
    systemPrompt,
    userMessage,
    content,
    logContext,
    apiKey,
  })
  const v1 = validate(first)
  if (v1 != null) {
    return { value: v1, escalated: false, raw: first }
  }
  if (firstTier !== 'haiku') {
    throw new Error('Validation failed and intent is already on Sonnet')
  }
  // Escalate to Sonnet. Force sonnet by calling with a sonnet-tier intent.
  const sonnetIntent: TaskIntent = 'plan'
  const escalatedLog: LogContext | undefined = logContext
    ? { ...logContext, escalatedFrom: 'haiku' }
    : undefined
  const second = await modelCall({
    taskType: sonnetIntent,
    systemPrompt,
    userMessage,
    content,
    logContext: escalatedLog,
    apiKey,
  })
  const v2 = validate(second)
  if (v2 == null) {
    throw new Error('Validation failed on both Haiku and Sonnet')
  }
  return { value: v2, escalated: true, raw: second }
}
