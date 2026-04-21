'use client'

interface Item {
  headline: string
  source?: string
  url: string
  summary?: string
  why_it_matters: string
  topics?: string[]
}

interface Props {
  title: string
  generated_at: string
  items: Item[]
}

export function ArticleBriefCard({ title, generated_at, items }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className="card-subtitle">{generated_at}</span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="card-row">
          <div className="card-row-main">
            <div className="card-row-title">
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.headline} ↗
              </a>
            </div>
            {item.source && (
              <div className="card-row-sub">{item.source}</div>
            )}
            {item.summary && (
              <div className="card-row-sub" style={{ marginTop: 4 }}>
                {item.summary}
              </div>
            )}
            <div
              className="card-row-sub"
              style={{
                marginTop: 6,
                color: 'var(--accent)',
                fontStyle: 'italic',
              }}
            >
              Why this matters: {item.why_it_matters}
            </div>
            {item.topics && item.topics.length > 0 && (
              <div className="card-meta-row" style={{ marginTop: 6 }}>
                {item.topics.map((t) => (
                  <span key={t} className="card-pill">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
