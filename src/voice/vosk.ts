import {
  normalizeVoiceCommand,
  type VoiceCommand,
  type VoiceController,
  type VoiceState,
} from './contracts'

const SAMPLE_RATE = 16_000
const MODEL_LOAD_TIMEOUT_MS = 60_000
const FEEDBACK_DURATION_MS = 1_500
const COMMAND_GRAMMAR = JSON.stringify([
  '上',
  '下',
  '左',
  '右',
  '确认',
  '好的',
  '欧克',
  '哦可',
  '欧凯',
  '奥凯',
  '欧',
  '哦',
  '喔',
  '噢',
  '欧了',
  '哦了',
  'ok',
  'okay',
  '好',
  '可以',
  '好了',
  '我好了',
  '可以了',
  '准备好',
  '准备好了',
  '我准备好了',
  '[unk]',
])

interface StoppableTrack {
  stop(): void
}

interface MediaStreamLike {
  getTracks(): StoppableTrack[]
}

interface Disconnectable {
  disconnect(): void
}

interface ProcessorNodeLike extends Disconnectable {
  onaudioprocess: ((event: { inputBuffer: AudioBuffer }) => void) | null
}

interface AudioContextLike {
  readonly sampleRate?: number
  readonly state?: string
  close(): Promise<void> | void
  resume?(): Promise<void> | void
}

interface VoskAudioGraph {
  audioContext: AudioContextLike
  source: Disconnectable
  processor: ProcessorNodeLike
  gain: Disconnectable
}

interface VoskRecognitionMessage {
  result: {
    text?: string
    partial?: string
  }
}

interface VoskRecognizer {
  on(event: string, listener: (message: VoskRecognitionMessage) => void): void
  setWords(words: boolean): void
  acceptWaveform(buffer: AudioBuffer): void
  remove(): void
}

interface VoskModel {
  KaldiRecognizer: new (sampleRate: number, grammar?: string) => VoskRecognizer
  terminate(): void
}

export interface VoskRuntime {
  createModel(path: string): Promise<VoskModel>
  getUserMedia(): Promise<MediaStreamLike>
  createAudioGraph(stream: MediaStreamLike): VoskAudioGraph
}

const browserRuntime: VoskRuntime = {
  createModel: async (path) => {
    const { createModel } = await import('vosk-browser')
    return (await createModel(path, -1)) as unknown as VoskModel
  },
  getUserMedia: async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new DOMException('Microphone unavailable', 'NotSupportedError')
    }
    return navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: SAMPLE_RATE,
      },
    })
  },
  createAudioGraph: (stream) => {
    const AudioContextConstructor = window.AudioContext
    if (!AudioContextConstructor) {
      throw new DOMException('Web Audio unavailable', 'NotSupportedError')
    }
    const audioContext = new AudioContextConstructor({ sampleRate: SAMPLE_RATE })
    const source = audioContext.createMediaStreamSource(stream as MediaStream)
    const processor = audioContext.createScriptProcessor(4096, 1, 1)
    const gain = audioContext.createGain()
    gain.gain.value = 0
    source.connect(processor)
    processor.connect(gain)
    gain.connect(audioContext.destination)
    return { audioContext, source, processor, gain } as unknown as VoskAudioGraph
  },
}

function permissionErrorDetail(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return '离线模型加载超时，已切换备用输入'
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return '麦克风权限被拒绝，已切换键盘模式'
  }
  if (error instanceof DOMException && error.name === 'NotFoundError') {
    return '没有检测到麦克风，已切换键盘模式'
  }
  return '离线语音模型启动失败，已切换键盘模式'
}

async function loadModelWithTimeout(
  path: string,
  runtime: VoskRuntime,
): Promise<VoskModel> {
  const modelPromise = runtime.createModel(path)
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new DOMException('Vosk model load timed out', 'TimeoutError'))
    }, MODEL_LOAD_TIMEOUT_MS)
  })

  try {
    return await Promise.race([modelPromise, timeoutPromise])
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      void modelPromise.then((lateModel) => lateModel.terminate()).catch(() => undefined)
    }
    throw error
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}

export async function createVoskController(
  modelPath: string,
  onCommand: (command: VoiceCommand) => void,
  onState: (state: VoiceState, detail?: string) => void,
  runtime: VoskRuntime = browserRuntime,
): Promise<VoiceController | null> {
  let model: VoskModel | null = null
  let recognizer: VoskRecognizer | null = null
  let stream: MediaStreamLike | null = null
  let graph: VoskAudioGraph | null = null
  let stopped = false
  let paused = false
  let recognizerRun = 0
  let lastPartialCommand: VoiceCommand | null = null
  let lastPartialAt = Number.NEGATIVE_INFINITY
  let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  const partialDuplicateWindowMs = 900

  const commandLabel: Record<VoiceCommand, string> = {
    up: '上',
    down: '下',
    left: '左',
    right: '右',
    confirm: '准备好了',
  }

  const clearFeedbackTimer = () => {
    if (feedbackTimer === undefined) return
    globalThis.clearTimeout(feedbackTimer)
    feedbackTimer = undefined
  }

  const resumeListeningSoon = () => {
    clearFeedbackTimer()
    feedbackTimer = globalThis.setTimeout(() => {
      feedbackTimer = undefined
      if (!stopped && !paused) onState('listening', '正在听 · 请说“上、下、左、右”')
    }, FEEDBACK_DURATION_MS)
  }

  const release = async (reportIdle: boolean) => {
    if (stopped) return
    stopped = true
    clearFeedbackTimer()
    if (graph?.processor) graph.processor.onaudioprocess = null
    stream?.getTracks().forEach((track) => track.stop())
    graph?.source.disconnect()
    graph?.processor.disconnect()
    graph?.gain.disconnect()
    await graph?.audioContext.close()
    recognizer?.remove()
    model?.terminate()
    if (reportIdle) onState('idle')
  }

  onState('loading', '正在请求麦克风权限')
  try {
    stream = await runtime.getUserMedia()
    graph = runtime.createAudioGraph(stream)
    if (graph.audioContext.state === 'suspended') await graph.audioContext.resume?.()
    onState('loading', '麦克风已打开 · 正在加载离线模型')
    model = await loadModelWithTimeout(modelPath, runtime)
    const activeModel = model
    const activeGraph = graph
    const emitCommand = (command: VoiceCommand) => {
      clearFeedbackTimer()
      onState('listening', `已听到：${commandLabel[command]}`)
      onCommand(command)
      resumeListeningSoon()
    }
    const installRecognizer = () => {
      const run = recognizerRun + 1
      recognizerRun = run
      lastPartialCommand = null
      lastPartialAt = Number.NEGATIVE_INFINITY
      const nextRecognizer = new activeModel.KaldiRecognizer(
        activeGraph.audioContext.sampleRate ?? SAMPLE_RATE,
        COMMAND_GRAMMAR,
      )
      nextRecognizer.setWords(true)
      const isCurrentRun = () => (
        !stopped &&
        !paused &&
        recognizerRun === run &&
        recognizer === nextRecognizer
      )
      nextRecognizer.on('partialresult', (message) => {
        if (!isCurrentRun()) return
        const command = normalizeVoiceCommand(message.result.partial ?? '')
        if (!command) return
        const now = Date.now()
        if (
          command === lastPartialCommand &&
          now - lastPartialAt < partialDuplicateWindowMs
        ) return
        lastPartialCommand = command
        lastPartialAt = now
        emitCommand(command)
      })
      nextRecognizer.on('result', (message) => {
        if (!isCurrentRun()) return
        const command = normalizeVoiceCommand(message.result.text ?? '')
        const duplicatesRecentPartial = Boolean(
          command &&
          command === lastPartialCommand &&
          Date.now() - lastPartialAt < partialDuplicateWindowMs * 2,
        )
        lastPartialCommand = null
        lastPartialAt = Number.NEGATIVE_INFINITY
        if (duplicatesRecentPartial) return
        if (command) {
          emitCommand(command)
          return
        }
        onState('fallback', '没听清 · 请重新说当前方向')
        resumeListeningSoon()
      })
      return nextRecognizer
    }
    recognizer = installRecognizer()
    graph.processor.onaudioprocess = (event) => {
      if (paused) return
      try {
        recognizer?.acceptWaveform(event.inputBuffer)
      } catch {
        onState('error', '语音处理暂时中断，方向键仍可使用')
      }
    }
    onState('listening', '正在听 · 请说“上、下、左、右”')

    return {
      engine: 'vosk',
      pause: async () => {
        if (stopped || paused) return
        paused = true
        recognizerRun += 1
        const previousRecognizer = recognizer
        recognizer = null
        previousRecognizer?.remove()
        clearFeedbackTimer()
        onState('loading', '正在播报提示…')
      },
      resume: async () => {
        if (stopped || !paused) return
        paused = false
        recognizer = installRecognizer()
        onState('listening', '正在听 · 请说“上、下、左、右”')
      },
      stop: () => release(true),
    }
  } catch (error) {
    await release(false)
    onState('error', permissionErrorDetail(error))
    return null
  }
}
