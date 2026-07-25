import { describe, expect, it, vi } from 'vitest'

import {
  isCommandAllowed,
  normalizeVoiceCommand,
  resolveVoiceEngine,
} from './contracts'
import { resetEmbeddedVoskModelForTests } from './embeddedModel'
import { createVoskController, type VoskRuntime } from './vosk'
import { canUseBundledVosk, createVoiceController, readVoiceConfiguration } from './voice'

describe('voice command contract', () => {
  it.each([
    ['上', 'up'],
    [' 下 ', 'down'],
    ['左', 'left'],
    ['右', 'right'],
    ['确 认', 'confirm'],
    ['OK', 'confirm'],
    [' ok ', 'confirm'],
    ['欧克', 'confirm'],
    ['哦可', 'confirm'],
    ['欧凯', 'confirm'],
    ['奥凯', 'confirm'],
    ['好的', 'confirm'],
    ['好', 'confirm'],
    ['好了', 'confirm'],
    ['我好了', 'confirm'],
    ['可以', 'confirm'],
    ['可以了', 'confirm'],
    ['准备好', 'confirm'],
    ['准备好了', 'confirm'],
    ['我准备好了', 'confirm'],
    ['欧', 'confirm'],
    ['哦', 'confirm'],
    ['喔', 'confirm'],
    ['噢', 'confirm'],
    ['欧了', 'confirm'],
    ['哦了', 'confirm'],
    ['OK。', 'confirm'],
    ['okay', 'confirm'],
  ] as const)('normalizes the exact Mandarin command %s', (spoken, expected) => {
    expect(normalizeVoiceCommand(spoken)).toBe(expected)
  })

  it.each([
    '上学',
    '下面',
    '左右',
    '确认一下',
    '我可以去',
    'okay later',
    'up',
    '',
    '[unk]',
  ])(
    'rejects non-command speech %s',
    (spoken) => {
      expect(normalizeVoiceCommand(spoken)).toBeNull()
    },
  )

  it('allows confirmation only during setup and directions only during testing', () => {
    expect(isCommandAllowed('confirm', 'distance-confirmation')).toBe(true)
    expect(isCommandAllowed('up', 'distance-confirmation')).toBe(false)
    expect(isCommandAllowed('confirm', 'direction-test')).toBe(false)
    expect(isCommandAllowed('left', 'direction-test')).toBe(true)
  })
})

describe('voice engine selection', () => {
  it('uses bundled Vosk over a local site but not from an opaque file origin', () => {
    expect(canUseBundledVosk('http:')).toBe(true)
    expect(canUseBundledVosk('https:')).toBe(true)
    expect(canUseBundledVosk('file:')).toBe(false)
  })

  it('ships with the bundled Vosk model as the no-key default', () => {
    vi.stubGlobal('webkitSpeechRecognition', class {})
    try {
      const configuration = readVoiceConfiguration()

      expect(configuration.preference).toBe('vosk')
      expect(configuration.selectedEngine).toBe('vosk')
      expect(configuration.config.voskModelPath).toBe(
        '/models/vosk-model-small-cn-0.22.manifest.json',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('falls back safely when the hosted Vosk manifest cannot load', async () => {
    resetEmbeddedVoskModelForTests()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 503 }))
    const onState = vi.fn()

    await expect(createVoiceController(vi.fn(), onState, 'vosk')).resolves.toBeNull()
    expect(onState).toHaveBeenCalledWith(
      'fallback',
      '离线语音模型启动失败，已切换键盘模式',
    )
    vi.restoreAllMocks()
  })

  it('uses the configured Vosk engine when browser speech is unavailable', () => {
    expect(resolveVoiceEngine('auto', { voskModelPath: '/models/cn.tar.gz' })).toBe('vosk')
  })

  it('prefers browser speech in automatic mode and retains Vosk as fallback', () => {
    expect(
      resolveVoiceEngine('auto', {
        webSpeechAvailable: true,
        voskModelPath: '/models/cn.tar.gz',
      }),
    ).toBe('web-speech')
  })

  it('keeps Rhino available when it is explicitly selected and configured', () => {
    expect(
      resolveVoiceEngine('rhino', {
        rhinoAccessKey: 'local-demo-key',
        rhinoContextPath: '/models/context.rhn',
        rhinoModelPath: '/models/rhino.pv',
      }),
    ).toBe('rhino')
  })

  it('selects the online engine only when the browser API is available', () => {
    expect(resolveVoiceEngine('web-speech', { webSpeechAvailable: true })).toBe(
      'web-speech',
    )
    expect(resolveVoiceEngine('web-speech', { webSpeechAvailable: false })).toBe(
      'keyboard',
    )
  })

  it('falls back to keyboard when the requested engine is not configured', () => {
    expect(resolveVoiceEngine('vosk', {})).toBe('keyboard')
    expect(resolveVoiceEngine('rhino', {})).toBe('keyboard')
    expect(resolveVoiceEngine('keyboard', { voskModelPath: '/models/cn.tar.gz' })).toBe('keyboard')
    expect(resolveVoiceEngine('auto', {})).toBe('keyboard')
  })

  it('uses configured Rhino in automatic mode only when Vosk is absent', () => {
    expect(
      resolveVoiceEngine('auto', {
        rhinoAccessKey: 'local-demo-key',
        rhinoContextPath: '/models/context.rhn',
        rhinoModelPath: '/models/rhino.pv',
      }),
    ).toBe('rhino')
  })
})

describe('Vosk controller lifecycle', () => {
  it('invalidates paused recognizer callbacks and starts fresh on resume', async () => {
    type RecognitionMessage = { result: { text?: string; partial?: string } }
    type RecognitionListeners = {
      partial?: (message: RecognitionMessage) => void
      result?: (message: RecognitionMessage) => void
    }
    const recognitionRuns: RecognitionListeners[] = []
    const onCommand = vi.fn()
    const runtime: VoskRuntime = {
      createModel: vi.fn().mockResolvedValue({
        KaldiRecognizer: class {
          private readonly listeners: RecognitionListeners = {}

          constructor() {
            recognitionRuns.push(this.listeners)
          }

          on(event: string, listener: (message: RecognitionMessage) => void) {
            if (event === 'partialresult') this.listeners.partial = listener
            if (event === 'result') this.listeners.result = listener
          }

          acceptWaveform() {}
          remove() {}
          setWords() {}
        },
        terminate() {},
      }),
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      createAudioGraph: vi.fn().mockReturnValue({
        audioContext: { close: vi.fn(), sampleRate: 16_000 },
        source: { disconnect: vi.fn() },
        processor: { disconnect: vi.fn(), onaudioprocess: null },
        gain: { disconnect: vi.fn() },
      }),
    }

    const controller = await createVoskController('/models/cn.tar', onCommand, vi.fn(), runtime)
    expect(recognitionRuns).toHaveLength(1)

    await controller?.pause()
    recognitionRuns[0].partial?.({ result: { partial: '准备好了' } })
    recognitionRuns[0].result?.({ result: { text: '准备好了' } })
    expect(onCommand).not.toHaveBeenCalled()

    await controller?.resume()
    expect(recognitionRuns).toHaveLength(2)
    recognitionRuns[0].partial?.({ result: { partial: '准备好了' } })
    expect(onCommand).not.toHaveBeenCalled()
    recognitionRuns[1].partial?.({ result: { partial: '准备好了' } })
    expect(onCommand).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenLastCalledWith('confirm')

    await controller?.stop()
  })

  it('emits an exact partial command immediately and deduplicates its final result', async () => {
    type RecognitionMessage = { result: { text: string; partial?: string } }
    let resultListener: ((message: RecognitionMessage) => void) | undefined
    let partialListener: ((message: RecognitionMessage) => void) | undefined
    const onCommand = vi.fn()
    const runtime: VoskRuntime = {
      createModel: vi.fn().mockResolvedValue({
        KaldiRecognizer: class {
          on(event: string, listener: (message: RecognitionMessage) => void) {
            if (event === 'result') resultListener = listener
            if (event === 'partialresult') partialListener = listener
          }
          acceptWaveform() {}
          remove() {}
          setWords() {}
        },
        terminate() {},
      }),
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      createAudioGraph: vi.fn().mockReturnValue({
        audioContext: { close: vi.fn(), sampleRate: 16_000 },
        source: { disconnect: vi.fn() },
        processor: { disconnect: vi.fn(), onaudioprocess: null },
        gain: { disconnect: vi.fn() },
      }),
    }

    const controller = await createVoskController('/models/cn.tar', onCommand, vi.fn(), runtime)
    partialListener?.({ result: { text: '', partial: 'OK' } })
    expect(onCommand).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenLastCalledWith('confirm')

    resultListener?.({ result: { text: 'OK' } })
    expect(onCommand).toHaveBeenCalledOnce()
    await controller?.stop()
  })

  it('accepts a new partial confirmation after the duplicate window even without a final result', async () => {
    vi.useFakeTimers()
    type RecognitionMessage = { result: { text?: string; partial?: string } }
    let partialListener: ((message: RecognitionMessage) => void) | undefined
    const onCommand = vi.fn()
    const runtime: VoskRuntime = {
      createModel: vi.fn().mockResolvedValue({
        KaldiRecognizer: class {
          on(event: string, listener: (message: RecognitionMessage) => void) {
            if (event === 'partialresult') partialListener = listener
          }
          acceptWaveform() {}
          remove() {}
          setWords() {}
        },
        terminate() {},
      }),
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
      createAudioGraph: vi.fn(() => ({
        audioContext: { close: vi.fn(), sampleRate: 16_000 },
        source: { disconnect: vi.fn() },
        processor: { disconnect: vi.fn(), onaudioprocess: null },
        gain: { disconnect: vi.fn() },
      })),
    }

    const controller = await createVoskController('/models/cn.tar', onCommand, vi.fn(), runtime)
    partialListener?.({ result: { partial: 'OK' } })
    await vi.advanceTimersByTimeAsync(1_100)
    partialListener?.({ result: { partial: 'OK' } })

    expect(onCommand).toHaveBeenNthCalledWith(1, 'confirm')
    expect(onCommand).toHaveBeenNthCalledWith(2, 'confirm')
    await controller?.stop()
    vi.useRealTimers()
  })

  it('opens the microphone before waiting for the large offline model', async () => {
    const order: string[] = []
    const runtime: VoskRuntime = {
      getUserMedia: vi.fn().mockImplementation(async () => {
        order.push('microphone')
        return { getTracks: () => [{ stop: vi.fn() }] }
      }),
      createModel: vi.fn().mockImplementation(async () => {
        order.push('model')
        return {
          KaldiRecognizer: class {
            on() {}
            acceptWaveform() {}
            remove() {}
            setWords() {}
          },
          terminate() {},
        }
      }),
      createAudioGraph: vi.fn().mockImplementation(() => {
        order.push('audio')
        return {
          audioContext: { close: vi.fn(), sampleRate: 16_000 },
          source: { disconnect: vi.fn() },
          processor: { disconnect: vi.fn(), onaudioprocess: null },
          gain: { disconnect: vi.fn() },
        }
      }),
    }

    const controller = await createVoskController('/models/cn.tar', vi.fn(), vi.fn(), runtime)

    expect(order).toEqual(['microphone', 'audio', 'model'])
    await controller?.stop()
  })

  it('stops waiting for a model that never finishes loading', async () => {
    vi.useFakeTimers()
    try {
      const onState = vi.fn()
      const runtime: VoskRuntime = {
        createModel: vi.fn().mockReturnValue(new Promise(() => undefined)),
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        createAudioGraph: vi.fn().mockReturnValue({
          audioContext: { close: vi.fn(), sampleRate: 16_000 },
          source: { disconnect: vi.fn() },
          processor: { disconnect: vi.fn(), onaudioprocess: null },
          gain: { disconnect: vi.fn() },
        }),
      }
      let settled = false

      void createVoskController('/models/cn.tar.gz', vi.fn(), onState, runtime).then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(60_000)

      expect(settled).toBe(true)
      expect(onState).toHaveBeenLastCalledWith(
        'error',
        '离线模型加载超时，已切换备用输入',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a missed command briefly, then resumes listening without a sticky fallback', async () => {
    vi.useFakeTimers()
    let resultListener: ((message: { result: { text: string } }) => void) | undefined
    const remove = vi.fn()
    const terminate = vi.fn()
    const stopTrack = vi.fn()
    const disconnectSource = vi.fn()
    const disconnectProcessor = vi.fn()
    const disconnectGain = vi.fn()
    const closeAudio = vi.fn().mockResolvedValue(undefined)
    const acceptWaveform = vi.fn()
    const onCommand = vi.fn()
    const onState = vi.fn()
    const processor = { disconnect: disconnectProcessor, onaudioprocess: null } as {
      disconnect: () => void
      onaudioprocess: ((event: { inputBuffer: AudioBuffer }) => void) | null
    }

    const runtime: VoskRuntime = {
      createModel: vi.fn().mockResolvedValue({
        KaldiRecognizer: class {
          on(event: string, listener: typeof resultListener) {
            if (event === 'result') resultListener = listener
          }

          acceptWaveform = acceptWaveform
          remove = remove
          setWords() {}
        },
        terminate,
      }),
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: stopTrack }],
      }),
      createAudioGraph: vi.fn().mockReturnValue({
        audioContext: { close: closeAudio },
        source: { disconnect: disconnectSource },
        processor,
        gain: { disconnect: disconnectGain },
      }),
    }

    const controller = await createVoskController(
      '/models/cn.tar.gz',
      onCommand,
      onState,
      runtime,
    )

    const audioBuffer = {} as AudioBuffer
    await controller?.pause()
    processor.onaudioprocess?.({ inputBuffer: audioBuffer })
    expect(acceptWaveform).not.toHaveBeenCalled()
    await controller?.resume()
    processor.onaudioprocess?.({ inputBuffer: audioBuffer })
    expect(acceptWaveform).toHaveBeenCalledOnce()

    resultListener?.({ result: { text: '上' } })
    expect(onState).toHaveBeenCalledWith('listening', '已听到：上')
    resultListener?.({ result: { text: '上学' } })
    resultListener?.({ result: { text: '左右' } })

    expect(onCommand).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenCalledWith('up')
    expect(onState).toHaveBeenLastCalledWith(
      'fallback',
      '没听清 · 请重新说当前方向',
    )
    await vi.advanceTimersByTimeAsync(1_800)
    expect(onState).toHaveBeenLastCalledWith(
      'listening',
      '正在听 · 请说“上、下、左、右”',
    )

    processor.onaudioprocess?.({ inputBuffer: audioBuffer })
    expect(acceptWaveform).toHaveBeenCalledTimes(2)

    await controller?.stop()
    await controller?.stop()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(disconnectSource).toHaveBeenCalledOnce()
    expect(disconnectProcessor).toHaveBeenCalledOnce()
    expect(disconnectGain).toHaveBeenCalledOnce()
    expect(closeAudio).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledTimes(2)
    expect(terminate).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('reports an error without leaking a partially loaded model', async () => {
    const terminate = vi.fn()
    const onState = vi.fn()
    const runtime: VoskRuntime = {
      createModel: vi.fn().mockResolvedValue({
        KaldiRecognizer: class {
          on() {}
          acceptWaveform() {}
          remove() {}
          setWords() {}
        },
        terminate,
      }),
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')),
      createAudioGraph: vi.fn(),
    }

    await expect(
      createVoskController('/models/cn.tar.gz', vi.fn(), onState, runtime),
    ).resolves.toBeNull()

    expect(onState).toHaveBeenLastCalledWith('error', '麦克风权限被拒绝，已切换键盘模式')
    expect(runtime.createModel).not.toHaveBeenCalled()
    expect(terminate).not.toHaveBeenCalled()
  })

  it.each([
    [new DOMException('missing', 'NotFoundError'), '没有检测到麦克风，已切换键盘模式'],
    [new Error('model corrupt'), '离线语音模型启动失败，已切换键盘模式'],
  ])('maps startup failures to a safe keyboard fallback', async (failure, detail) => {
    const onState = vi.fn()
    const microphoneFailure = failure instanceof DOMException && failure.name === 'NotFoundError'
    const runtime: VoskRuntime = {
      createModel: microphoneFailure
        ? vi.fn()
        : vi.fn().mockRejectedValue(failure),
      getUserMedia: microphoneFailure
        ? vi.fn().mockRejectedValue(failure)
        : vi.fn().mockResolvedValue({ getTracks: () => [] }),
      createAudioGraph: vi.fn().mockReturnValue({
        audioContext: { close: vi.fn(), sampleRate: 16_000 },
        source: { disconnect: vi.fn() },
        processor: { disconnect: vi.fn(), onaudioprocess: null },
        gain: { disconnect: vi.fn() },
      }),
    }

    await expect(
      createVoskController('/models/cn.tar.gz', vi.fn(), onState, runtime),
    ).resolves.toBeNull()

    expect(onState).toHaveBeenLastCalledWith('error', detail)
  })
})
