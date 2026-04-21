'use client'

interface Meal {
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe_name: string
  servings: number
  prep_minutes?: number
  cook_minutes?: number
  ingredients: string[]
  instructions: string[]
  source_url?: string
  tags?: string[]
}

interface Props {
  title: string
  week_of: string
  meals: Meal[]
}

export function MealPlanCard({ title, week_of, meals }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className="card-subtitle">Week of {week_of}</span>
      </div>
      {meals.map((m, i) => (
        <div key={i} className="card-meal">
          <div className="card-meal-head">
            <span className="card-meal-date">{m.date}</span>
            <span className="card-meal-type">{m.meal_type}</span>
          </div>
          <div className="card-meal-name">{m.recipe_name}</div>
          <div className="card-meta-row">
            <span className="card-pill">{m.servings} servings</span>
            {typeof m.prep_minutes === 'number' && (
              <span className="card-pill">prep {m.prep_minutes}m</span>
            )}
            {typeof m.cook_minutes === 'number' && (
              <span className="card-pill">cook {m.cook_minutes}m</span>
            )}
            {m.source_url && (
              <a
                className="card-pill is-accent"
                href={m.source_url}
                target="_blank"
                rel="noreferrer"
              >
                recipe ↗
              </a>
            )}
          </div>
          <details className="card-meal-notes">
            <summary>Ingredients · Instructions</summary>
            <p className="card-section-label" style={{ marginTop: 8 }}>
              Ingredients
            </p>
            <ul>
              {m.ingredients.map((ing, j) => (
                <li key={j}>{ing}</li>
              ))}
            </ul>
            <p className="card-section-label" style={{ marginTop: 8 }}>
              Instructions
            </p>
            <ol>
              {m.instructions.map((step, j) => (
                <li key={j}>{step}</li>
              ))}
            </ol>
          </details>
        </div>
      ))}
    </div>
  )
}
