// Card tool registry. Each entry is a real Anthropic tool the model calls
// when it wants to render a structured UI block instead of plain prose.
// Anthropic validates the schema at the API; the client renders via the
// components/cards dispatcher.

import type { ToolDefinition } from './model-router'

export const CARD_TOOLS: ToolDefinition[] = [
  {
    name: 'card_meal_plan',
    description:
      "Render a week's meal plan with recipes, dates, and servings.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        week_of: { type: 'string', description: 'ISO date' },
        meals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              meal_type: {
                type: 'string',
                enum: ['breakfast', 'lunch', 'dinner', 'snack'],
              },
              recipe_name: { type: 'string' },
              servings: { type: 'number' },
              prep_minutes: { type: 'number' },
              cook_minutes: { type: 'number' },
              ingredients: { type: 'array', items: { type: 'string' } },
              instructions: { type: 'array', items: { type: 'string' } },
              source_url: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: [
              'date',
              'meal_type',
              'recipe_name',
              'servings',
              'ingredients',
              'instructions',
            ],
          },
        },
      },
      required: ['title', 'week_of', 'meals'],
    },
  },
  {
    name: 'card_shopping_list',
    description: 'Render a categorized shopping list with checkable items.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    quantity: { type: 'string' },
                    notes: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['category', 'items'],
          },
        },
        estimated_cost: { type: 'number' },
      },
      required: ['title', 'categories'],
    },
  },
  {
    name: 'card_workout_session',
    description:
      "Render today's workout with exercises, sets, reps, and logging UI.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string' },
        focus: {
          type: 'string',
          description:
            "e.g., 'Upper Push', 'Full Body', 'Conditioning'",
        },
        estimated_minutes: { type: 'number' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              sets: { type: 'number' },
              reps: {
                type: 'string',
                description: "e.g., '8-10' or '5' or 'AMRAP'",
              },
              target_weight: {
                type: 'string',
                description: "e.g., '135 lb' or 'bodyweight' or 'band'",
              },
              rest_seconds: { type: 'number' },
              notes: { type: 'string' },
            },
            required: ['name', 'sets', 'reps'],
          },
        },
      },
      required: ['title', 'date', 'exercises'],
    },
  },
  {
    name: 'card_email_digest',
    description: 'Render categorized email summary with action buttons.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        generated_at: { type: 'string' },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                enum: ['act_today', 'reply_this_week', 'fyi', 'noise'],
              },
              emails: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    thread_id: { type: 'string' },
                    from: { type: 'string' },
                    subject: { type: 'string' },
                    summary: { type: 'string' },
                    drafted_reply: {
                      type: 'string',
                      description:
                        'Optional drafted response for routine replies',
                    },
                  },
                  required: ['thread_id', 'from', 'subject', 'summary'],
                },
              },
            },
            required: ['category', 'emails'],
          },
        },
        noise_summary: {
          type: 'string',
          description: 'One-paragraph summary of the noise bucket',
        },
      },
      required: ['title', 'generated_at', 'categories'],
    },
  },
  {
    name: 'card_article_brief',
    description:
      "Render a curated list of articles with 'why this matters' context.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        generated_at: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              source: { type: 'string' },
              url: { type: 'string' },
              summary: { type: 'string' },
              why_it_matters: { type: 'string' },
              topics: { type: 'array', items: { type: 'string' } },
            },
            required: ['headline', 'source', 'url', 'why_it_matters'],
          },
        },
      },
      required: ['title', 'generated_at', 'items'],
    },
  },
  {
    name: 'card_weekly_summary',
    description:
      'Render a weekly review card for any agent (workout volume, meals cooked, articles read, etc.).',
    input_schema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string' },
        title: { type: 'string' },
        week_of: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        stats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
              delta: {
                type: 'string',
                description: "e.g., '+15%' or '-2' or 'new PR'",
              },
            },
            required: ['label', 'value'],
          },
        },
        next_week_preview: { type: 'string' },
      },
      required: ['agent_id', 'title', 'week_of', 'highlights'],
    },
  },
  {
    name: 'card_confirm_action',
    description:
      'Render a confirm card when the model wants to execute a confirm-tool (send email, create calendar event, etc.). User taps confirm to execute.',
    input_schema: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          description: "e.g., 'send_email', 'create_calendar_event'",
        },
        summary: {
          type: 'string',
          description: 'Human-readable description of what will happen',
        },
        payload: {
          type: 'object',
          description: 'The action parameters to execute on confirm',
        },
      },
      required: ['action_type', 'summary', 'payload'],
    },
  },
]

export function isCardToolName(name: string): boolean {
  return name.startsWith('card_')
}
