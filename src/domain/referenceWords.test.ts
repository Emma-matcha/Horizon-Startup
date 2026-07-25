import { describe, expect, it } from 'vitest'

import { REFERENCE_WORDS, selectNextReferenceWord } from './referenceWords'

describe('reference word selection', () => {
  it('ships a varied set of short everyday Chinese words', () => {
    expect(REFERENCE_WORDS.length).toBeGreaterThanOrEqual(24)
    expect(REFERENCE_WORDS.every((word) => [...word].length === 2)).toBe(true)
    expect(new Set(REFERENCE_WORDS).size).toBe(REFERENCE_WORDS.length)
  })

  it('never immediately repeats the previous displayed word', () => {
    const previous = REFERENCE_WORDS[0]

    expect(selectNextReferenceWord([previous], () => 0)).not.toBe(previous)
    expect(selectNextReferenceWord([previous], () => 0.999999)).not.toBe(previous)
  })

  it('prefers words not yet seen in the current test', () => {
    const history = REFERENCE_WORDS.slice(0, 4)

    expect(history).not.toContain(selectNextReferenceWord(history, () => 0))
  })

  it('normalizes invalid or out-of-range random values safely', () => {
    expect(REFERENCE_WORDS).toContain(selectNextReferenceWord([], () => Number.NaN))
    expect(REFERENCE_WORDS).toContain(selectNextReferenceWord([], () => 9))
    expect(REFERENCE_WORDS).toContain(selectNextReferenceWord([], () => -2))
  })
})
