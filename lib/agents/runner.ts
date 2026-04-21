import type { SupabaseClient } from '@supabase/supabase-js'
import {
  modelCallFull,
  type AssistantBlock,
  type ContentBlock,
  type ModelMessage,
  type ToolDefinition,
} from '@/lib/model-router'
import { CARD_TOOLS } from '@/lib/cards'
import { TOOLS, isConfirmTool } from '@/lib/tools'
import { TOOL_IMPLS } from '@/lib/tools/impls'
import type { AgentDefinition, AgentContext } from './types'
import type { UserProfile, MemoryRecord } from '@/lib/types'

const MAX_ITERATIONS = 8

export interface AgentRunResult {
  /** Assistant blocks across all turns, filtered so the client can render them. */
  content: AssistantBlock[]
  /** Total tool calls executed across the loop. */
  tool_calls: number
  /** Summary text extracted from the final assistant turn. */
  summary: string
}

/**
 * Load the context the agent needs to run: profile, agent profile, recent
 * records tagged for this agent. Agents also call read_memory themselves
 * inside the tool loop, so this is just a warm-start.
 */
export async function loadAgentContext(
  supabase: SupabaseClient,
  userId: string,
  agent: AgentDefinition
): Promise<AgentContext> {
  const [{ data: profile }, { data: agentProfile }, { data: records }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('agent_profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('agent_id', agent.id)
        .maybeSingle(),
      supabase
        .from('records')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .contains('tags', [`agent:${agent.id}`])
        .order('created_at', { ascending: false })
        .limit(30),
    ])

  return {
    userId,
    supabase,
    profile: (profile as UserProfile) || null,
    agentProfile: agentProfile || null,
    recentRecords: (records as MemoryRecord[]) || [],
    now: new Date(),
  }
}

function buildToolDefinitions(agent: AgentDefinition): ToolDefinition[] {
  const real = agent.tools
    .map((n) => TOOLS[n]?.definition)
    .filter((d): d is ToolDefinition => !!d)
  // Also advertise confirm tools so the model knows they exist (and that it
  // must route them through card_confirm_action).
  const confirm = Object.values(TOOLS)
    .filter((t) => t.requires_confirmation)
    .map((t) => t.definition)
  const cards = CARD_TOOLS.filter((c) => agent.card_tools.includes(c.name))
  return [...real, ...confirm, ...cards]
}

export async function runAgent(
  ctx: AgentContext,
  agent: AgentDefinition,
  userMessage?: string
): Promise<AgentRunResult> {
  const systemPrompt = agent.buildSystemPrompt(ctx)
  const kickoff =
    userMessage ??
    (agent.buildKickoffMessage
      ? agent.buildKickoffMessage(ctx)
      : 'Please run.')

  const tools = buildToolDefinitions(agent)
  const messages: ModelMessage[] = [
    { role: 'user', content: kickoff },
  ]

  const emittedBlocks: AssistantBlock[] = []
  let toolCalls = 0

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const resp = await modelCallFull({
      taskType: agent.task_type,
      systemPrompt,
      messages,
      tools,
      maxTokens: 4096,
    })

    // Record assistant blocks — text + card tool_use blocks are surfaced to UI.
    messages.push({
      role: 'assistant',
      content: resp.content as ContentBlock[],
    })

    for (const block of resp.content) {
      if (block.type === 'text' || block.type === 'tool_use') {
        emittedBlocks.push(block)
      }
    }

    if (resp.stop_reason !== 'tool_use') {
      break
    }

    // Execute each non-card tool_use, append tool_result blocks.
    const toolUses = resp.content.filter(
      (b): b is Extract<AssistantBlock, { type: 'tool_use' }> =>
        b.type === 'tool_use'
    )

    const results: ContentBlock[] = []
    for (const use of toolUses) {
      if (use.name.startsWith('card_')) {
        // Cards are UI, not server work. Acknowledge without executing.
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify({ rendered: true }),
        })
        continue
      }
      if (isConfirmTool(use.name)) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          is_error: true,
          content: JSON.stringify({
            error: `${use.name} requires user confirmation. Emit card_confirm_action with action_type="${use.name}" and payload instead of calling this tool directly.`,
          }),
        })
        continue
      }
      const impl = TOOL_IMPLS[use.name]
      if (!impl) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          is_error: true,
          content: JSON.stringify({
            error: `No server implementation for ${use.name}`,
          }),
        })
        continue
      }
      try {
        toolCalls++
        const out = await impl(
          { userId: ctx.userId, supabase: ctx.supabase },
          use.input
        )
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(out),
        })
      } catch (err) {
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          is_error: true,
          content: JSON.stringify({ error: (err as Error).message }),
        })
      }
    }

    if (results.length === 0) break
    messages.push({ role: 'user', content: results })
  }

  const summary = emittedBlocks
    .filter((b): b is Extract<AssistantBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .slice(0, 500)

  return {
    content: emittedBlocks,
    tool_calls: toolCalls,
    summary,
  }
}
