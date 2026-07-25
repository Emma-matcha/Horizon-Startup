import type { Direction } from '../domain/optotype'
import { FEEDBACK_OUTPUT_GAIN } from './levels'

export type FeedbackKind = 'pass' | 'error'

export interface FeedbackTone {
  frequency: number
  offset: number
  duration: number
}

const FEEDBACK_SEQUENCES: Record<FeedbackKind, readonly FeedbackTone[]> = {
  pass: [
    { frequency: 659.25, offset: 0, duration: 0.075 },
    { frequency: 880, offset: 0.072, duration: 0.11 },
  ],
  error: [
    { frequency: 246.94, offset: 0, duration: 0.09 },
    { frequency: 164.81, offset: 0.082, duration: 0.14 },
  ],
}

let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null
  sharedContext ??= new window.AudioContext()
  return sharedContext
}

export function feedbackKindForAnswer(
  expected: Direction,
  answered: Direction,
): FeedbackKind {
  return expected === answered ? 'pass' : 'error'
}

export function getFeedbackSequence(kind: FeedbackKind): readonly FeedbackTone[] {
  return FEEDBACK_SEQUENCES[kind]
}

export function getFeedbackPeakGain(kind: FeedbackKind): number {
  void kind
  return FEEDBACK_OUTPUT_GAIN
}

export function primeFeedbackAudio(enabled = true): void {
  if (!enabled) return
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume()
}

export async function playFeedbackSound(kind: FeedbackKind, enabled = true): Promise<void> {
  if (!enabled) return
  const context = getAudioContext()
  if (!context) return

  try {
    if (context.state === 'suspended') await context.resume()
    const start = context.currentTime + 0.008
    const tones = getFeedbackSequence(kind)
    const peakGain = getFeedbackPeakGain(kind)
    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, start)
    output.gain.exponentialRampToValueAtTime(peakGain, start + 0.012)
    const finish = Math.max(...tones.map((tone) => tone.offset + tone.duration))
    output.gain.setValueAtTime(peakGain, start + Math.max(0.02, finish - 0.045))
    output.gain.exponentialRampToValueAtTime(0.0001, start + finish)
    output.connect(context.destination)

    tones.forEach((tone, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = kind === 'pass' ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(tone.frequency, start + tone.offset)
      oscillator.connect(output)
      oscillator.start(start + tone.offset)
      oscillator.stop(start + tone.offset + tone.duration)
      if (index === tones.length - 1) oscillator.onended = () => output.disconnect()
    })
  } catch {
    // Audio feedback is supplementary; the vision flow must never block on it.
  }
}
