import type { AgentDefinition } from './types'
import { voiceInstructions } from './voices'

export const kitchenSteward: AgentDefinition = {
  id: 'kitchen-steward',
  default_display_name: 'Kitchen Steward',
  description: 'Weekly meal plans + consolidated shopping lists.',
  emoji: '🍳',
  task_type: 'agent_run',
  voices: ['concierge', 'assistant', 'curator'],
  cadence_hint: 'weekly sunday 14:00 local',
  tools: ['search_web', 'scrape_url', 'read_memory', 'write_memory'],
  card_tools: ['card_meal_plan', 'card_shopping_list', 'card_weekly_summary'],
  first_run_questions: [
    {
      id: 'diet',
      question: 'What are your dietary constraints?',
      type: 'multi_select',
      options: [
        'vegetarian',
        'vegan',
        'gluten-free',
        'dairy-free',
        'nut allergies',
        'none',
      ],
    },
    {
      id: 'household',
      question: 'How many people are you cooking for?',
      type: 'number',
    },
    {
      id: 'budget',
      question: "What's your weekly grocery budget?",
      type: 'select',
      options: ['under $75', '$75-150', '$150-250', '$250+'],
    },
    {
      id: 'cuisines',
      question: 'What cuisines do you love?',
      type: 'text',
    },
    {
      id: 'avoid',
      question: 'Any ingredients you dislike or avoid?',
      type: 'text',
    },
    {
      id: 'meals_per_week',
      question: 'How many meals per week should I plan?',
      type: 'select',
      options: ['3', '5', '7', 'every meal'],
    },
    {
      id: 'display_name',
      question: 'Pick a name for me.',
      type: 'text',
      default: 'Kitchen Steward',
    },
    {
      id: 'voice',
      question: 'Pick my voice.',
      type: 'select',
      options: ['concierge', 'assistant', 'curator'],
    },
  ],
  buildSystemPrompt: (ctx) => {
    const name = ctx.agentProfile?.display_name || 'Kitchen Steward'
    const userName = ctx.profile?.name || 'friend'
    return `You are ${name}, a meal planning agent for ${userName}.

Your job: read their dietary prefs, household size, budget, cuisine preferences, and recent meals from memory. Generate a weekly meal plan that respects all constraints and avoids recent repeats. Build a consolidated shopping list deduped against pantry staples if tracked.

Process:
1. Call read_memory (tag: "agent:kitchen-steward") to load the user's dietary constraints, household size, budget, pantry, recent meals
2. Use search_web and scrape_url to find real recipes that match
3. Generate 5-7 recipes for the week
4. Render via card_meal_plan
5. Generate a consolidated shopping list and render via card_shopping_list
6. Call write_memory with content_type: 'meal_plan' and tags: ['agent:kitchen-steward','meal_plan'] so you avoid repeating recipes next run

${voiceInstructions(ctx.agentProfile?.voice)}`
  },
  buildKickoffMessage: (ctx) => {
    const today = ctx.now.toISOString().slice(0, 10)
    return `Plan my meals for the week starting ${today}. Avoid anything I've had in the last two weeks. Render a meal plan card and shopping list card.`
  },
}
