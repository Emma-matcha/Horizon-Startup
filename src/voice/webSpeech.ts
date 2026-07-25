import {
  normalizeVoiceCommand,
  type VoiceCommand,
  type VoiceController,
  type VoiceState,
} from './contracts'

interface WebSpeechAlternativeLike {
  transcript: string
}

interface WebSpeechResultLike {
  readonly isFinal: boolean
  readonly 0: WebSpeechAlternativeLike
}

interface WebSpeechResultEventLike {
  readonly resultIndex: number
  readonly results: ArrayLike<WebSpeechResultLike>
}

interface WebSpeechErrorEventLike {
  readonly error: string
  readonly message?: string
}

export interface WebSpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onend: (() => void) | null
  onerror: ((event: WebSpeechErrorEventLike) => void) | null
  onnomatch: (() => void) | null
  onresult: ((event: WebSpeechResultEventLike) => void) | null
  onstart: (() => void) | null
  abort: () => void
  start: () => void
}

type WebSpeechConstructor = new () => WebSpeechRecognitionLike

export interface WebSpeechRuntime {
  createRecognition: () => WebSpeechRecognitionLike | null
  isOnline: () => boolean
  scheduleRestart: (callback: () => void, delayMs: number) => number
  cancelRestart: (id: number) => void
}

type SpeechWindow = Window & {
  SpeechRecognition?: WebSpeechConstructor
  webkitSpeechRecognition?: WebSpeechConstructor
}

function browserRuntime(): WebSpeechRuntime {
  return {
    createRecognition: () => {
      const speechWindow = window as SpeechWindow
      const Recognition =
        speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
      return Recognition ? new Recognition() : null
    },
    isOnline: () => navigator.onLine,
    scheduleRestart: (callback, delayMs) => window.setTimeout(callback, delayMs),
    cancelRestart: (id) => window.clearTimeout(id),
  }
}

export function isWebSpeechAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const speechWindow = window as SpeechWindow
  return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition)
}

function errorCopy(error: string): string {
  if (error === 'network') return '在线语音连接失败，键盘方向键仍可使用'
  if (error === 'not-allowed' || error === 'service-not-allowed') {
    return '麦克风权限被拒绝，键盘方向键仍可使用'
  }
  if (error === 'audio-capture') return '没有检测到麦克风，键盘方向键仍可使用'
  return '在线语音暂不可用，键盘方向键仍可使用'
}

export async function createWebSpeechController(
  onCommand: (command: VoiceCommand) => void,
  onState: (state: VoiceState, detail?: string) => void,
  runtime: WebSpeechRuntime = browserRuntime(),
): Promise<VoiceController | null> {
  onState('loading', '正在连接 Chrome 在线语音备用')

  if (!runtime.isOnline()) {
    onState('unavailable', '当前没有网络，无法启用在线语音备用')
    return null
  }

  const recognition = runtime.createRecognition()
  if (!recognition) {
    onState('unavailable', '当前浏览器不支持在线语音，键盘方向键仍可使用')
    return null
  }

  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  let stopped = false
  let paused = false
  let restartTimer: number | null = null
  let rejectedCount = 0

  const rejectResult = () => {
    rejectedCount += 1
    if (rejectedCount >= 2) {
      onState('fallback', '连续两次未听清，已显示方向按钮')
      return
    }
    onState('listening', '未听清，请再说一次')
  }

  recognition.onstart = () => {
    onState('listening', '在线语音备用已开启 · 语音可能由浏览器服务处理')
  }
  recognition.onnomatch = rejectResult
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      if (!result?.isFinal) continue
      const command = normalizeVoiceCommand(result[0]?.transcript ?? '')
      if (!command) {
        rejectResult()
        continue
      }
      rejectedCount = 0
      onCommand(command)
    }
  }
  recognition.onerror = (event) => {
    if (event.error === 'no-speech') {
      rejectResult()
      return
    }
    if ((stopped || paused) && event.error === 'aborted') return
    stopped = true
    onState('error', errorCopy(event.error))
  }
  recognition.onend = () => {
    if (stopped || paused || !runtime.isOnline()) return
    restartTimer = runtime.scheduleRestart(() => {
      if (stopped) return
      try {
        recognition.start()
      } catch {
        stopped = true
        onState('error', '在线语音暂不可用，键盘方向键仍可使用')
      }
    }, 250)
  }

  try {
    recognition.start()
  } catch {
    stopped = true
    onState('error', '在线语音暂不可用，键盘方向键仍可使用')
    return null
  }

  return {
    engine: 'web-speech',
    pause: async () => {
      if (stopped || paused) return
      paused = true
      if (restartTimer !== null) {
        runtime.cancelRestart(restartTimer)
        restartTimer = null
      }
      recognition.abort()
      onState('loading', '正在播报提示…')
    },
    resume: async () => {
      if (stopped || !paused) return
      paused = false
      try {
        recognition.start()
      } catch {
        stopped = true
        onState('error', '在线语音暂不可用，键盘方向键仍可使用')
      }
    },
    stop: async () => {
      if (stopped) return
      stopped = true
      if (restartTimer !== null) {
        runtime.cancelRestart(restartTimer)
        restartTimer = null
      }
      recognition.abort()
      onState('idle')
    },
  }
}
