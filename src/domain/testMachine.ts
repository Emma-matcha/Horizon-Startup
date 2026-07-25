import { DIRECTIONS, type Direction } from './optotype'

export type CompletionReason = 'three_consecutive_wrong' | 'upper_bound'

export interface EyeTestState {
  readonly level: number
  readonly consecutiveWrong: number
  readonly bestCorrectLevel: number | null
  readonly status: 'active' | 'complete'
  readonly completionReason?: CompletionReason
}

const MIN_LEVEL = 4.0
const MAX_LEVEL = 5.3

function normalizeLevel(level: number): number {
  return Number(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level)).toFixed(1))
}

export function createEyeTestState(): EyeTestState {
  return {
    level: 4.6,
    consecutiveWrong: 0,
    bestCorrectLevel: null,
    status: 'active',
  }
}

export function applyEyeAnswer(
  state: Readonly<EyeTestState>,
  correct: boolean,
): EyeTestState {
  if (state.status === 'complete') return { ...state }

  if (correct) {
    const bestCorrectLevel = Math.max(
      state.bestCorrectLevel ?? MIN_LEVEL,
      state.level,
    )
    if (state.level >= MAX_LEVEL) {
      return {
        ...state,
        consecutiveWrong: 0,
        bestCorrectLevel,
        status: 'complete',
        completionReason: 'upper_bound',
      }
    }
    return {
      level: normalizeLevel(state.level + 0.1),
      consecutiveWrong: 0,
      bestCorrectLevel,
      status: 'active',
    }
  }

  const consecutiveWrong = state.consecutiveWrong + 1
  if (consecutiveWrong >= 3) {
    return {
      ...state,
      consecutiveWrong,
      status: 'complete',
      completionReason: 'three_consecutive_wrong',
    }
  }

  return {
    ...state,
    level:
      consecutiveWrong === 2
        ? normalizeLevel(state.level - 0.1)
        : state.level,
    consecutiveWrong,
    status: 'active',
  }
}

export function selectNextDirection(
  history: readonly Direction[],
  random: () => number = secureRandomUnit,
): Direction {
  const previous = history.at(-1)
  const nonRepeating = previous
    ? DIRECTIONS.filter((direction) => direction !== previous)
    : [...DIRECTIONS]
  const irregularCandidates = nonRepeating.filter(
    (direction) =>
      !wouldRepeatPattern(history, direction, 2) &&
      !wouldRepeatPattern(history, direction, 3),
  )
  const candidates = irregularCandidates.length > 0 ? irregularCandidates : nonRepeating
  const draw = random()
  const normalizedDraw = Number.isFinite(draw)
    ? Math.min(Math.max(draw, 0), 1 - Number.EPSILON)
    : 0

  return candidates[Math.floor(normalizedDraw * candidates.length)]
}

function wouldRepeatPattern(
  history: readonly Direction[],
  candidate: Direction,
  patternLength: number,
): boolean {
  const sequence = [...history, candidate]
  if (sequence.length < patternLength * 2) return false

  const start = sequence.length - patternLength * 2
  for (let offset = 0; offset < patternLength; offset += 1) {
    if (sequence[start + offset] !== sequence[start + patternLength + offset]) {
      return false
    }
  }
  return true
}

function secureRandomUnit(): number {
  if (globalThis.crypto?.getRandomValues) {
    const entropy = new Uint32Array(1)
    globalThis.crypto.getRandomValues(entropy)
    return entropy[0] / 0x1_0000_0000
  }
  return Math.random()
}
