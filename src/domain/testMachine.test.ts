import { describe, expect, it } from 'vitest'

import {
  applyEyeAnswer,
  createEyeTestState,
  selectNextDirection,
} from './testMachine'

describe('eye test state machine', () => {
  it('starts at 4.6 with no score', () => {
    expect(createEyeTestState()).toMatchObject({
      level: 4.6,
      consecutiveWrong: 0,
      bestCorrectLevel: null,
      status: 'active',
    })
  })

  it('moves to a smaller optotype after a correct answer', () => {
    const next = applyEyeAnswer(createEyeTestState(), true)

    expect(next.level).toBe(4.7)
    expect(next.bestCorrectLevel).toBe(4.6)
    expect(next.consecutiveWrong).toBe(0)
  })

  it('stays on the same level after the first wrong answer', () => {
    const next = applyEyeAnswer(createEyeTestState(), false)

    expect(next.level).toBe(4.6)
    expect(next.consecutiveWrong).toBe(1)
    expect(next.status).toBe('active')
  })

  it('moves one level up after the second consecutive wrong answer', () => {
    const once = applyEyeAnswer(createEyeTestState(), false)
    const twice = applyEyeAnswer(once, false)

    expect(twice.level).toBe(4.5)
    expect(twice.consecutiveWrong).toBe(2)
    expect(twice.status).toBe('active')
  })

  it('ends after the third consecutive wrong answer', () => {
    let state = createEyeTestState()
    state = applyEyeAnswer(state, false)
    state = applyEyeAnswer(state, false)
    state = applyEyeAnswer(state, false)

    expect(state.status).toBe('complete')
    expect(state.completionReason).toBe('three_consecutive_wrong')
    expect(state.bestCorrectLevel).toBeNull()
  })

  it('resets the consecutive wrong count after any correct answer', () => {
    let state = createEyeTestState()
    state = applyEyeAnswer(state, false)
    state = applyEyeAnswer(state, false)
    state = applyEyeAnswer(state, true)

    expect(state.consecutiveWrong).toBe(0)
    expect(state.bestCorrectLevel).toBe(4.5)
    expect(state.level).toBe(4.6)
  })

  it('ends at the exploratory upper bound after a correct 5.3 answer', () => {
    const state = {
      ...createEyeTestState(),
      level: 5.3,
      bestCorrectLevel: 5.2,
    } as const
    const next = applyEyeAnswer(state, true)

    expect(next.status).toBe('complete')
    expect(next.completionReason).toBe('upper_bound')
    expect(next.bestCorrectLevel).toBe(5.3)
  })
})
describe('selectNextDirection', () => {
  it('never repeats the immediately previous direction', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      expect(selectNextDirection(['left'], seed)).not.toBe('left')
    }
  })

  it('returns one of the four supported directions', () => {
    expect(['up', 'right', 'down', 'left']).toContain(
      selectNextDirection([], 42),
    )
  })
})
