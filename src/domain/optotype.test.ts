import { describe, expect, it } from 'vitest'

import {
  DEFAULT_OPTOTYPE_LEVELS,
  getOptotypeGrid,
  getOptotypeMetrics,
} from './optotype'

describe('getOptotypeMetrics', () => {
  it('calculates the 5.0 optotype at two metres on a 224 ppi display', () => {
    const metrics = getOptotypeMetrics(5.0)

    expect(metrics.outerMm).toBeCloseTo(2.90888, 5)
    expect(metrics.nativePx).toBeCloseTo(25.65, 2)
    expect(metrics.cssPx).toBeCloseTo(12.83, 2)
    expect(metrics.strokeNativePx).toBeCloseTo(5.13, 2)
    expect(metrics.archivePx).toBe(26)
  })

  it('uses a constant logarithmic ratio between adjacent levels', () => {
    const level46 = getOptotypeMetrics(4.6)
    const level47 = getOptotypeMetrics(4.7)

    expect(level46.nativePx / level47.nativePx).toBeCloseTo(10 ** 0.1, 6)
  })

  it('defines 5.2 as the scored cap and 5.3 as exploratory', () => {
    expect(DEFAULT_OPTOTYPE_LEVELS.at(-2)).toMatchObject({
      level: 5.2,
      usage: 'scored_cap',
    })
    expect(DEFAULT_OPTOTYPE_LEVELS.at(-1)).toMatchObject({
      level: 5.3,
      usage: 'exploratory_only',
    })
  })
})
describe('getOptotypeGrid', () => {
  it('creates a strict 5 by 5 tumbling E with 17 black cells', () => {
    const grid = getOptotypeGrid('right')

    expect(grid).toHaveLength(5)
    expect(grid.every((row) => row.length === 5)).toBe(true)
    expect(grid.flat().filter(Boolean)).toHaveLength(17)
    expect(grid).toEqual([
      [true, true, true, true, true],
      [true, false, false, false, false],
      [true, true, true, true, true],
      [true, false, false, false, false],
      [true, true, true, true, true],
    ])
  })

  it('rotates the same geometry without changing its black area', () => {
    const directions = ['up', 'right', 'down', 'left'] as const
    const serialized = directions.map((direction) =>
      getOptotypeGrid(direction).flat().join(''),
    )

    expect(new Set(serialized)).toHaveLength(4)
    for (const direction of directions) {
      expect(getOptotypeGrid(direction).flat().filter(Boolean)).toHaveLength(17)
    }
  })
})
