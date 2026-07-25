import {
  normalizeVoiceCommand,
  type VoiceCommand,
  type VoiceController,
  type VoiceState,
} from './contracts'

const SAMPLE_RATE = 16_000
const MODEL_LOAD_TIMEOUT_MS = 20_000
const COMMAND_GRAMMAR = JSON.stringify(['上', '下', '左', '右', '确认', '[unk]'])

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
  close(): Promise<void> | void
}

interface VoskAudioGraph {
  audioContext: AudioContextLike
  source: Disconnectable
  processor: ProcessorNodeLike
  gain: Disconnectable
}

interface VoskRecognizer {
  on(event: string, listener: (message: { result: { text: string } }) => void): void
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
  let consecutiveRejected = 0

  const release = async (reportIdle: boolean) => {
    if (stopped) return
    stopped = true
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

  onState('loading', '正在本地加载 Vosk 中文模型')
  try {
    model = await loadModelWithTimeout(modelPath, runtime)
    stream = await runtime.getUserMedia()
    graph = runtime.createAudioGraph(stream)
    recognizer = new model.KaldiRecognizer(
      graph.audioContext.sampleRate ?? SAMPLE_RATE,
      COMMAND_GRAMMAR,
    )
    recognizer.setWords(true)
    recognizer.on('result', (message) => {
      const command = normalizeVoiceCommand(message.result.text)
      if (command) {
        consecutiveRejected = 0
        onState('listening')
        onCommand(command)
        return
      }
      consecutiveRejected += 1
      if (consecutiveRejected >= 2) {
        onState('fallback', '连续两次未听清，已显示方向按钮')
      } else {
        onState('listening', '未听清，请再说一次')
      }
    })
    graph.processor.onaudioprocess = (event) => {
      try {
        recognizer?.acceptWaveform(event.inputBuffer)
      } catch {
        onState('error', '语音处理暂时中断，方向键仍可使用')
      }
    }
    onState('listening')

    return {
      engine: 'vosk',
      stop: () => release(true),
    }
  } catch (error) {
    await release(false)
    onState('error', permissionErrorDetail(error))
    return null
  }
}
