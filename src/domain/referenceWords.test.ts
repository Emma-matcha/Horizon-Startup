import { describe, expect, it } from 'vitest'

import { REFERENCE_WORDS, selectNextReferenceWord } from './referenceWords'

describe('reference word selection', () => {
  it('ships a varied set of short everyday English words', () => {
    expect(REFERENCE_WORDS.length).toBeGreaterThanOrEqual(24)
    expect(
      REFERENCE_WORDS.every(
        ({ en, zh }) => /^[a-z]{3,6}$/.test(en) && zh.trim().length > 0,
      ),
    ).toBe(true)
    expect(new Set(REFERENCE_WORDS.map(({ en }) => en)).size).toBe(
      REFERENCE_WORDS.length,
    )
  })

  it('never immediately repeats the previous displayed word', () => {
    const previous = REFERENCE_WORDS[0].en

    expect(selectNextReferenceWord([previous], () => 0).en).not.toBe(previous)
    expect(selectNextReferenceWord([previous], () => 0.999999).en).not.toBe(previous)
  })

  it('prefers words not yet seen in the current test', () => {
    const history = REFERENCE_WORDS.slice(0, 4).map(({ en }) => en)

    expect(history).not.toContain(selectNextReferenceWord(history, () => 0).en)
  })

  it('normalizes invalid or out-of-range random values safely', () => {
    expect(REFERENCE_WORDS).toContain(selectNextReferenceWord([], () => Number.NaN))
    expect(REFERENCE_WORDS).toContain(selectNextReferenceWord([], () => 9))
    expect(REFERENCE_WORDS).toContain(selectNextReferenceWord([], () => -2))
  })
})
