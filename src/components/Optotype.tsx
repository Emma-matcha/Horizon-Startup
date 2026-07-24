import {
  getOptotypeGrid,
  getOptotypeMetrics,
  type Direction,
} from '../domain/optotype'

const directionLabel: Record<Direction, string> = {
  up: '上',
  right: '右',
  down: '下',
  left: '左',
}

interface OptotypeProps {
  direction: Direction
  level: number
  scale?: number
  className?: string
}

export function Optotype({
  direction,
  level,
  scale = 1,
  className = '',
}: OptotypeProps) {
  const grid = getOptotypeGrid(direction)
  const size = getOptotypeMetrics(level).cssPx * scale

  return (
    <div
      aria-label={`E 字视标，缺口向${directionLabel[direction]}`}
      className={`optotype ${className}`}
      data-direction={direction}
      data-level={level.toFixed(1)}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {grid.flatMap((row, rowIndex) =>
        row.map((filled, columnIndex) => (
          <span
            data-cell={filled ? 'ink' : 'space'}
            key={`${rowIndex}-${columnIndex}`}
          />
        )),
      )}
    </div>
  )
}
