import type { AgentDefinition } from './types'
import { voiceInstructions } from './voices'
import { FAILURE_HANDLING_BLOCK } from './shared'

export const signalKeeper: AgentDefinition = {
  id: 'signal-keeper',
  default_display_name: 'Signal',
  description:
    'Curated daily brief of articles that actually matter to you.',
  emoji: '📡',
  task_type: 'agent_run',
  voices: ['curator', 'analyst', 'assistant'],
  cadence_hint: 'daily 06:00 local',
  tools: ['search_web', 'scrape_url', 'read_memory', 'write_memory'],
  card_tools: ['card_article_brief', 'card_weekly_summary'],
  first_run_questions: [
    {
      id: 'topics',
      question:
        'What topics do you want to track? (broad or specific — "AI policy", "Colorado AI Act")',
      type: 'text',
    },
    {
      id: 'trusted_sources',
      question:
        'Any specific sources you trust? (URLs, publications, writer names)',
      type: 'text',
    },
    {
      id: 'excluded_sources',
      question: 'Any sources to always exclude?',
      type: 'text',
    },
    {
      id: 'items_per_brief',
      question: 'How many items per daily brief?',
      type: 'select',
      options: ['3', '5', '7', '10'],
    },
    {
      id: 'depth',
      question: 'Depth preference?',
      type: 'select',
      options: ['quick scan', 'balanced', 'deep dive'],
    },
    {
      id: 'display_name',
      question: 'Pick a name for me.',
      type: 'text',
      default: 'Signal',
    },
    {
      id: 'voice',
      question: 'Pick my voice.',
      type: 'select',
      options: ['curator', 'analyst', 'assistant'],
    },
  ],
  buildSystemPrompt: (ctx) => {
    const name = ctx.agentProfile?.display_name || 'Signal'
    const userName = ctx.profile?.name || 'friend'
    return `You are ${name}, a signal curation agent for ${userName}.

Your job: scan for new content on their tracked topics, filter out noise, surface 3-10 items that actually matter with a specific "why this matters to you" for each — tied to what you know about them from memory.

Process:
1. Call read_memory (tag: "agent:signal-keeper") for topics, trusted sources, excluded sources, already-seen items (last 30 days), and anything else in memory that reveals user context
2. Use search_web with varied queries across their topics (recent + today — include date/recency in the query)
3. For promising results, scrape_url to read full content before including them
4. Filter ruthlessly — quality over quantity. The "why this matters" must be SPECIFIC to the user's known context, not generic.
5. Render card_article_brief with the curated items
6. Call write_memory with content_type: 'daily_brief' and tags ['agent:signal-keeper','brief'] recording what you surfaced so you don't repeat yourself

${FAILURE_HANDLING_BLOCK}

${voiceInstructions(ctx.agentProfile?.voice)}`
  },
  buildKickoffMessage: (ctx) => {
    const today = ctx.now.toISOString().slice(0, 10)
    return `Build my daily brief for ${today}. Scan my topics, pull what's new, and render as an article brief card.`
  },
}
