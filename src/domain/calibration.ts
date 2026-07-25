import { getOptotypeMetrics } from './optotype'

export const CALIBRATION_REFERENCE_MM = 50
export const DEFAULT_CALIBRATION_CSS_PX = 220.47
export const MIN_CALIBRATION_CSS_PX = 120
export const MAX_CALIBRATION_CSS_PX = 360

export function clampCalibrationCssPx(value: number): number {
  return Math.min(
    MAX_CALIBRATION_CSS_PX,
    Math.max(MIN_CALIBRATION_CSS_PX, value),
  )
}

export function getCalibratedOptotypeCssPx(
  level: number,
  calibrationCssPx: number,
  distanceMm = 2_000,
): number {
  const { outerMm } = getOptotypeMetrics(level, distanceMm)
  return outerMm * (calibrationCssPx / CALIBRATION_REFERENCE_MM)
}
