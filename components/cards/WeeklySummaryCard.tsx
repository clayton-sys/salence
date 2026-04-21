'use client'

interface Stat {
  label: string
  value: string
  delta?: string
}

interface Props {
  agent_id: string
  title: string
  week_of: string
  highlights: string[]
  stats?: Stat[]
  next_week_preview?: string
}

export function WeeklySummaryCard({
  title,
  week_of,
  highlights,
  stats,
  next_week_preview,
  agent_id,
}: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        <span className="card-subtitle">
          {agent_id} · week of {week_of}
        </span>
      </div>

      {stats && stats.length > 0 && (
        <div className="card-section">
          <p className="card-section-label">Stats</p>
          <div className="card-stat-grid">
            {stats.map((s) => (
              <div key={s.label} className="card-stat">
                <div className="card-stat-label">{s.label}</div>
                <div className="card-stat-value">
                  {s.value}
                  {s.delta && <span className="card-stat-delta">{s.delta}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-section">
        <p className="card-section-label">Highlights</p>
        <ul>
          {highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>

      {next_week_preview && (
        <div className="card-section">
          <p className="card-section-label">Next week</p>
          <p className="card-row-sub">{next_week_preview}</p>
        </div>
      )}
    </div>
  )
}
