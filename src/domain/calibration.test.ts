import { describe, expect, it } from 'vitest'

import {
  clampCalibrationCssPx,
  getCalibratedOptotypeCssPx,
} from './calibration'

describe('cross-platform physical calibration', () => {
  it('derives optotype CSS size from the measured 50 mm line', () => {
    const cssPixelsPerMillimeter = 192 / 50
    const expected = 2.9088823 * cssPixelsPerMillimeter

    expect(getCalibratedOptotypeCssPx(5.0, 192)).toBeCloseTo(expected, 5)
  })

  it('supports the expanded Windows display calibration range', () => {
    expect(clampCalibrationCssPx(80)).toBe(120)
    expect(clampCalibrationCssPx(192)).toBe(192)
    expect(clampCalibrationCssPx(420)).toBe(360)
  })
})
