'use client'

import { useState } from 'react'

interface Item {
  name: string
  quantity?: string
  notes?: string
}
interface Category {
  category: string
  items: Item[]
}
interface Props {
  title: string
  categories: Category[]
  estimated_cost?: number
}

export function ShoppingListCard({ title, categories, estimated_cost }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const keyOf = (c: string, i: number) => `${c}::${i}`
  const totalItems = categories.reduce((n, c) => n + c.items.length, 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className="card-subtitle">
          {checkedCount}/{totalItems}
          {typeof estimated_cost === 'number' && ` · ~$${estimated_cost}`}
        </span>
      </div>
      {categories.map((cat) => (
        <div key={cat.category} className="card-section">
          <p className="card-section-label">{cat.category}</p>
          <ul className="card-checklist">
            {cat.items.map((item, i) => {
              const k = keyOf(cat.category, i)
              const isChecked = !!checked[k]
              return (
                <li key={k} className={isChecked ? 'is-checked' : ''}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) =>
                      setChecked((prev) => ({ ...prev, [k]: e.target.checked }))
                    }
                  />
                  <span>
                    {item.quantity ? `${item.quantity} ` : ''}
                    {item.name}
                    {item.notes ? ` — ${item.notes}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
