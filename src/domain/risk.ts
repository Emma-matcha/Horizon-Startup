export type TrendStatus = 'insufficient' | 'stable' | 'observe' | 'retest'

export interface TrendAnalysis {
  status: TrendStatus
  baseline: number | null
  decline: number | null
}

const capScore = (score: number) => Math.min(5.2, score)
const roundTenth = (value: number) => Number(value.toFixed(1))

export function analyzeTrend(
  currentScore: number,
  priorScores: readonly number[],
): TrendAnalysis {
  if (priorScores.length < 3) {
    return { status: 'insufficient', baseline: null, decline: null }
  }

  const latestThree = priorScores.slice(-3).map(capScore).sort((a, b) => a - b)
  const baseline = latestThree[1]
  const decline = Math.max(0, roundTenth(baseline - capScore(currentScore)))
  const status: TrendStatus =
    decline >= 0.2 ? 'retest' : decline >= 0.1 ? 'observe' : 'stable'

  return { status, baseline, decline }
}
