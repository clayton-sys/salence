'use client'

import { MealPlanCard } from './MealPlanCard'
import { ShoppingListCard } from './ShoppingListCard'
import { WorkoutSessionCard } from './WorkoutSessionCard'
import { EmailDigestCard } from './EmailDigestCard'
import { ArticleBriefCard } from './ArticleBriefCard'
import { WeeklySummaryCard } from './WeeklySummaryCard'
import { ConfirmActionCard } from './ConfirmActionCard'

export interface CardToolUse {
  type: 'tool_use'
  id?: string
  name?: string
  input?: Record<string, unknown>
}

// The model is schema-validated by Anthropic's tool-use layer, so by the time
// we render we trust the shape. `any` here is deliberate — it mirrors the
// unvalidated-at-compile-time runtime contract from the LLM.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function renderCard(block: CardToolUse) {
  const name = block.name || ''
  const input = (block.input || {}) as any
  const key = block.id

  switch (name) {
    case 'card_meal_plan':
      return <MealPlanCard key={key} {...input} />
    case 'card_shopping_list':
      return <ShoppingListCard key={key} {...input} />
    case 'card_workout_session':
      return <WorkoutSessionCard key={key} toolUseId={block.id} {...input} />
    case 'card_email_digest':
      return <EmailDigestCard key={key} {...input} />
    case 'card_article_brief':
      return <ArticleBriefCard key={key} {...input} />
    case 'card_weekly_summary':
      return <WeeklySummaryCard key={key} {...input} />
    case 'card_confirm_action':
      return <ConfirmActionCard key={key} {...input} />
    default:
      return (
        <div className="card">
          <p className="card-subtitle">Unknown card: {name}</p>
          <pre className="md">
            <code>{JSON.stringify(input, null, 2)}</code>
          </pre>
        </div>
      )
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
