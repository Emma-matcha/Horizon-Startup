import type { ScreeningSession } from '../data/storage'

interface TrendChartProps {
  sessions: readonly ScreeningSession[]
  compact?: boolean
}

const WIDTH = 720
const HEIGHT = 250
const PAD_X = 45
const PAD_Y = 28

function pointsFor(
  sessions: readonly ScreeningSession[],
  key: 'rightEye' | 'leftEye',
) {
  const usableWidth = WIDTH - PAD_X * 2
  const usableHeight = HEIGHT - PAD_Y * 2
  return sessions
    .map((session, index) => {
      const x =
        PAD_X +
        (sessions.length === 1 ? usableWidth / 2 : (index / (sessions.length - 1)) * usableWidth)
      const value = Math.min(5.2, Math.max(4.0, session[key]))
      const y = PAD_Y + ((5.2 - value) / 1.2) * usableHeight
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function TrendChart({ sessions, compact = false }: TrendChartProps) {
  const ordered = [...sessions]
    .sort(
      (a, b) =>
        new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
    )
    .slice(compact ? -7 : -30)

  return (
    <figure className={`trend-chart ${compact ? 'trend-chart--compact' : ''}`}>
      <svg
        aria-label="左右眼视力变化趋势图"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#b93a2b" stopOpacity=".15" />
            <stop offset="1" stopColor="#b93a2b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[4.0, 4.4, 4.8, 5.2].map((value) => {
          const y = PAD_Y + ((5.2 - value) / 1.2) * (HEIGHT - PAD_Y * 2)
          return (
            <g key={value}>
              <line className="chart-grid" x1={PAD_X} x2={WIDTH - PAD_X} y1={y} y2={y} />
              <text className="chart-label" x="4" y={y + 4}>{value.toFixed(1)}</text>
            </g>
          )
        })}
        <polyline className="chart-line chart-line--right" points={pointsFor(ordered, 'rightEye')} />
        <polyline className="chart-line chart-line--left" points={pointsFor(ordered, 'leftEye')} />
        {ordered.map((session, index) => {
          const usableWidth = WIDTH - PAD_X * 2
          const x = PAD_X + (ordered.length === 1 ? usableWidth / 2 : (index / (ordered.length - 1)) * usableWidth)
          return (
            <g key={session.id}>
              {index % Math.ceil(Math.max(1, ordered.length / 6)) === 0 && (
                <text className="chart-date" x={x} y={HEIGHT - 3} textAnchor="middle">
                  {new Date(session.completedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption>
        <span><i className="legend-dot legend-dot--right" />右眼</span>
        <span><i className="legend-dot legend-dot--left" />左眼</span>
      </figcaption>
    </figure>
  )
}
