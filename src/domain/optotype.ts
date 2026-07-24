export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const

export type Direction = (typeof DIRECTIONS)[number]
export type OptotypeUsage = 'screening' | 'scored_cap' | 'exploratory_only'

export interface OptotypeLevel {
  level: number
  usage: OptotypeUsage
}

export interface OptotypeMetrics {
  level: number
  outerMm: number
  nativePx: number
  cssPx: number
  strokeNativePx: number
  archivePx: number
}

export const DEFAULT_OPTOTYPE_LEVELS: readonly OptotypeLevel[] = Array.from(
  { length: 14 },
  (_, index) => {
    const level = Number((4 + index / 10).toFixed(1))
    const usage: OptotypeUsage =
      level === 5.3
        ? 'exploratory_only'
        : level === 5.2
          ? 'scored_cap'
          : 'screening'
    return { level, usage }
  },
)

const BASE_E_GRID: readonly (readonly boolean[])[] = [
  [true, true, true, true, true],
  [true, false, false, false, false],
  [true, true, true, true, true],
  [true, false, false, false, false],
  [true, true, true, true, true],
]

function rotateClockwise(grid: readonly (readonly boolean[])[]): boolean[][] {
  return grid.map((_, row) =>
    grid.map((_, column) => grid[grid.length - 1 - column][row]),
  )
}

export function getOptotypeGrid(direction: Direction): boolean[][] {
  const rotations: Record<Direction, number> = {
    right: 0,
    down: 1,
    left: 2,
    up: 3,
  }
  let grid = BASE_E_GRID.map((row) => [...row])
  for (let index = 0; index < rotations[direction]; index += 1) {
    grid = rotateClockwise(grid)
  }
  return grid
}

export function getOptotypeMetrics(
  level: number,
  distanceMm = 2_000,
  pixelsPerInch = 224,
  devicePixelRatio = 2,
): OptotypeMetrics {
  const fiveArcMinutesInRadians = (5 / 60) * (Math.PI / 180)
  const levelFiveOuterMm =
    2 * distanceMm * Math.tan(fiveArcMinutesInRadians / 2)
  const outerMm = levelFiveOuterMm * 10 ** (5 - level)
  const nativePx = (outerMm * pixelsPerInch) / 25.4

  return {
    level,
    outerMm,
    nativePx,
    cssPx: nativePx / devicePixelRatio,
    strokeNativePx: nativePx / 5,
    archivePx: Math.round(nativePx),
  }
}
