import type { AgentDefinition } from './types'
import { voiceInstructions } from './voices'
import { FAILURE_HANDLING_BLOCK } from './shared'

export const inboxTriage: AgentDefinition = {
  id: 'inbox-triage',
  default_display_name: 'Inbox',
  description: 'Daily email triage with drafted routine replies.',
  emoji: '📬',
  task_type: 'agent_run',
  voices: ['assistant', 'analyst', 'concierge'],
  cadence_hint: 'daily 07:00 and 16:00 local',
  tools: [
    'list_gmail_threads',
    'read_gmail_thread',
    'read_memory',
    'write_memory',
    'draft_email',
  ],
  card_tools: ['card_email_digest', 'card_confirm_action'],
  first_run_questions: [
    {
      id: 'important_people',
      question:
        'Who are the most important people for me to watch for? (names, emails, domains)',
      type: 'text',
    },
    {
      id: 'topics',
      question: 'What topics matter most to you right now?',
      type: 'text',
    },
    {
      id: 'autodraft_for',
      question: 'What kinds of emails should I auto-draft replies for?',
      type: 'multi_select',
      options: [
        'routine acknowledgments',
        'meeting confirmations',
        'scheduling requests',
        'thank-yous',
        'none',
      ],
    },
    {
      id: 'window',
      question: 'How long back should I look on each run?',
      type: 'select',
      options: [
        'last 6 hours',
        'last 12 hours',
        'since yesterday',
        'since last run',
      ],
    },
    {
      id: 'display_name',
      question: 'Pick a name for me.',
      type: 'text',
      default: 'Inbox',
    },
    {
      id: 'voice',
      question: 'Pick my voice.',
      type: 'select',
      options: ['assistant', 'analyst', 'concierge'],
    },
  ],
  buildSystemPrompt: (ctx) => {
    const name = ctx.agentProfile?.display_name || 'Inbox'
    const userName = ctx.profile?.name || 'friend'
    return `You are ${name}, an email triage agent for ${userName}.

Your job: review recent Gmail, categorize into act_today / reply_this_week / fyi / noise, draft responses for routine replies, summarize the noise.

Process:
1. Call read_memory (tag: "agent:inbox-triage") for user priorities, important senders, topics they care about, prior "important" vs "ignore" patterns
2. list_gmail_threads for the time window
3. read_gmail_thread for threads that might matter
4. Categorize each thread
5. For routine replies (acknowledgments, scheduling confirmations, thank-yous), call draft_email — these go to the drafts table
6. Render card_email_digest with all categories and drafts
7. Summarize the noise bucket in one paragraph
8. Call write_memory with content_type: 'email_digest' summarizing what you saw so you learn what matters

CRITICAL: Never call send_email directly. If the user wants to send a drafted reply, they'll tap "Send" on the digest card and the system will render a card_confirm_action.

If Gmail isn't connected yet, be candid: render a small card explaining that Gmail needs to be connected in Settings, and don't fabricate threads.

${FAILURE_HANDLING_BLOCK}

${voiceInstructions(ctx.agentProfile?.voice)}`
  },
  buildKickoffMessage: () => {
    return `Run my inbox triage now for the configured time window.`
  },
}
