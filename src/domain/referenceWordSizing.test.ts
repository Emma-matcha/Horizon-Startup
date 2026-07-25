import { describe, expect, it, vi } from 'vitest'

import { getReferenceWordFontCssPx } from './referenceWordSizing'

describe('reference word physical sizing', () => {
  it('back-calculates font size so measured glyph ink equals the optotype edge', () => {
    const measure = (_word: string, fontCssPx: number) => ({
      actualBoundingBoxAscent: fontCssPx * 0.71,
      actualBoundingBoxDescent: fontCssPx * 0.02,
    })

    expect(getReferenceWordFontCssPx('clear', 25.65, measure)).toBeCloseTo(
      25.65 / 0.73,
      6,
    )
  })

  it('uses a safe measured fallback without changing the target physical size', () => {
    const invalidMeasure = () => ({ actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 })

    expect(getReferenceWordFontCssPx('light', 12.83, invalidMeasure)).toBeCloseTo(
      12.83 / 0.72,
      6,
    )
  })

  it('keeps the formula-derived estimate if a later browser metric is invalid', () => {
    let calls = 0
    const unstableMeasure = (_word: string, fontCssPx: number) => {
      calls += 1
      if (calls === 1) {
        return {
          actualBoundingBoxAscent: fontCssPx * 0.72,
          actualBoundingBoxDescent: 0,
        }
      }
      return { actualBoundingBoxAscent: Number.NaN, actualBoundingBoxDescent: 0 }
    }

    expect(getReferenceWordFontCssPx('road', 18, unstableMeasure)).toBeCloseTo(25, 6)
  })

  it('reads real Canvas glyph bounds when the browser text API is available', () => {
    const originalCanvasContext = globalThis.CanvasRenderingContext2D
    Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
      configurable: true,
      value: class {},
    })
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: vi.fn().mockImplementation(() => ({
        actualBoundingBoxAscent: 74,
        actualBoundingBoxDescent: 1,
      })),
    } as unknown as CanvasRenderingContext2D)

    try {
      expect(getReferenceWordFontCssPx('clear', 75)).toBeGreaterThan(0)
      expect(getContext).toHaveBeenCalled()
    } finally {
      getContext.mockRestore()
      if (originalCanvasContext) {
        Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
          configurable: true,
          value: originalCanvasContext,
        })
      } else {
        Reflect.deleteProperty(globalThis, 'CanvasRenderingContext2D')
      }
    }
  })
})
