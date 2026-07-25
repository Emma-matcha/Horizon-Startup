import { describe, expect, it } from 'vitest'

import {
  feedbackKindForAnswer,
  getFeedbackPeakGain,
  getFeedbackSequence,
} from './feedback'

describe('answer feedback audio', () => {
  it('selects pass only after comparing the shown and answered directions', () => {
    expect(feedbackKindForAnswer('left', 'left')).toBe('pass')
    expect(feedbackKindForAnswer('left', 'right')).toBe('error')
  })

  it('uses a short rising pass cue and a distinct falling error cue', () => {
    expect(getFeedbackSequence('pass')).toEqual([
      { frequency: 659.25, offset: 0, duration: 0.075 },
      { frequency: 880, offset: 0.072, duration: 0.11 },
    ])
    expect(getFeedbackSequence('error')).toEqual([
      { frequency: 246.94, offset: 0, duration: 0.09 },
      { frequency: 164.81, offset: 0.082, duration: 0.14 },
    ])
  })

  it('keeps pass and error cues at the same fixed peak loudness', () => {
    expect(getFeedbackPeakGain('pass')).toBe(0.075)
    expect(getFeedbackPeakGain('error')).toBe(0.075)
  })
})
