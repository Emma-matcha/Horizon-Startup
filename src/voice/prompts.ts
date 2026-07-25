import { SPEECH_OUTPUT_VOLUME } from '../audio/levels'

export interface SpeechPromptUtterance {
  text: string
  lang: string
  rate: number
  pitch: number
  volume?: number
  onend: (() => void) | null
  onerror: (() => void) | null
}

export interface SpeechPromptRuntime {
  cancel(): void
  speak(utterance: SpeechPromptUtterance): void
  createUtterance(text: string): SpeechPromptUtterance
}

function getBrowserRuntime(): SpeechPromptRuntime | null {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    !window.SpeechSynthesisUtterance
  ) {
    return null
  }

  return {
    cancel: () => window.speechSynthesis.cancel(),
    speak: (utterance) =>
      window.speechSynthesis.speak(utterance as SpeechSynthesisUtterance),
    createUtterance: (text) =>
      new window.SpeechSynthesisUtterance(text) as SpeechPromptUtterance,
  }
}

export function speakInstruction(
  text: string,
  runtime: SpeechPromptRuntime | null = getBrowserRuntime(),
  timeoutMs = 8_000,
): Promise<boolean> {
  if (!runtime) return Promise.resolve(false)

  return new Promise((resolve) => {
    const utterance = runtime.createUtterance(text)
    let settled = false
    const finish = (success: boolean) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timeoutId)
      resolve(success)
    }

    utterance.lang = 'zh-CN'
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.volume = SPEECH_OUTPUT_VOLUME
    utterance.onend = () => finish(true)
    utterance.onerror = () => finish(false)
    runtime.cancel()
    const timeoutId = globalThis.setTimeout(() => {
      runtime.cancel()
      finish(false)
    }, timeoutMs)
    runtime.speak(utterance)
  })
}

export function stopInstruction(runtime: SpeechPromptRuntime | null = getBrowserRuntime()) {
  runtime?.cancel()
}
