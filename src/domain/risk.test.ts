import { describe, expect, it } from 'vitest'

import { analyzeTrend } from './risk'

describe('analyzeTrend', () => {
  it('requires three prior valid results', () => {
    expect(analyzeTrend(4.8, [4.9, 4.9])).toEqual({
      status: 'insufficient',
      baseline: null,
      decline: null,
    })
  })

  it('uses the median of the latest three prior results', () => {
    expect(analyzeTrend(4.9, [4.7, 5.0, 4.9, 5.1])).toMatchObject({
      status: 'observe',
      baseline: 5.0,
      decline: 0.1,
    })
  })

  it('recommends retesting after a decline of 0.2 or more', () => {
    expect(analyzeTrend(4.8, [5.0, 5.1, 5.0])).toMatchObject({
      status: 'retest',
      baseline: 5.0,
      decline: 0.2,
    })
  })

  it('treats smaller variation as stable', () => {
    expect(analyzeTrend(5.0, [5.0, 5.0, 5.1])).toMatchObject({
      status: 'stable',
      baseline: 5.0,
      decline: 0,
    })
  })

  it('caps 5.3 at 5.2 before calculating trends', () => {
    expect(analyzeTrend(5.2, [5.3, 5.3, 5.3])).toMatchObject({
      status: 'stable',
      baseline: 5.2,
      decline: 0,
    })
  })
})
