import { describe, expect, it, vi } from 'vitest'

import {
  speakInstruction,
  type SpeechPromptRuntime,
  type SpeechPromptUtterance,
} from './prompts'

describe('spoken guidance', () => {
  it('speaks a concise Mandarin instruction and reports completion', async () => {
    const events: string[] = []
    let spokenVolume = 0
    const runtime: SpeechPromptRuntime = {
      cancel: vi.fn(() => events.push('cancel')),
      speak: vi.fn((utterance) => {
        events.push(utterance.text)
        spokenVolume = (utterance as SpeechPromptUtterance & { volume?: number }).volume ?? 0
        utterance.onend?.()
      }),
      createUtterance: (text) => ({ text, lang: '', rate: 0, pitch: 0, volume: 0, onend: null, onerror: null } as SpeechPromptUtterance),
    }

    await expect(
      speakInstruction('请确认您站到两米，准备好后请回复 OK。', runtime),
    ).resolves.toBe(true)

    expect(events).toEqual(['cancel', '请确认您站到两米，准备好后请回复 OK。'])
    expect(spokenVolume).toBe(0.45)
  })

  it('does not block the flow when speech synthesis is unavailable', async () => {
    await expect(speakInstruction('继续测试', null)).resolves.toBe(false)
  })

  it('releases voice input if the browser never reports speech completion', async () => {
    vi.useFakeTimers()
    const runtime: SpeechPromptRuntime = {
      cancel: vi.fn(),
      speak: vi.fn(),
      createUtterance: (text) => ({ text, lang: '', rate: 0, pitch: 0, onend: null, onerror: null }),
    }

    const result = speakInstruction('请回复 OK', runtime, 50)
    await vi.advanceTimersByTimeAsync(50)
    await expect(result).resolves.toBe(false)
    vi.useRealTimers()
  })
})
