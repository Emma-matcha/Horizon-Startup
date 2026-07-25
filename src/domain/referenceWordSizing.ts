export const REFERENCE_WORD_FONT_FAMILY = '"Avenir Next", "Segoe UI", Arial, sans-serif'
export const REFERENCE_WORD_FONT_WEIGHT = 500

const PROBE_FONT_CSS_PX = 100
const FALLBACK_INK_HEIGHT_RATIO = 0.72

export interface ReferenceWordTextMetrics {
  actualBoundingBoxAscent: number
  actualBoundingBoxDescent: number
}

export type ReferenceWordMeasure = (
  word: string,
  fontCssPx: number,
) => ReferenceWordTextMetrics

function browserMeasure(word: string, fontCssPx: number): ReferenceWordTextMetrics {
  if (typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') {
    return {
      actualBoundingBoxAscent: fontCssPx * FALLBACK_INK_HEIGHT_RATIO,
      actualBoundingBoxDescent: 0,
    }
  }

  const context = document.createElement('canvas').getContext('2d')
  if (!context) {
    return {
      actualBoundingBoxAscent: fontCssPx * FALLBACK_INK_HEIGHT_RATIO,
      actualBoundingBoxDescent: 0,
    }
  }
  context.font = `${REFERENCE_WORD_FONT_WEIGHT} ${fontCssPx}px ${REFERENCE_WORD_FONT_FAMILY}`
  return context.measureText(word)
}

function measuredInkHeight(
  word: string,
  fontCssPx: number,
  measure: ReferenceWordMeasure,
): number {
  const metrics = measure(word, fontCssPx)
  return metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
}

export function getReferenceWordFontCssPx(
  word: string,
  targetInkHeightCssPx: number,
  measure: ReferenceWordMeasure = browserMeasure,
): number {
  const probeInkHeight = measuredInkHeight(word, PROBE_FONT_CSS_PX, measure)
  const safeRatio = Number.isFinite(probeInkHeight) && probeInkHeight > 0
    ? probeInkHeight / PROBE_FONT_CSS_PX
    : FALLBACK_INK_HEIGHT_RATIO
  let fontCssPx = targetInkHeightCssPx / safeRatio

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const currentInkHeight = measuredInkHeight(word, fontCssPx, measure)
    if (!Number.isFinite(currentInkHeight) || currentInkHeight <= 0) break
    fontCssPx *= targetInkHeightCssPx / currentInkHeight
  }

  return fontCssPx
}
