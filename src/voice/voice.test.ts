import { describe, expect, it, vi } from 'vitest'

import {
  isCommandAllowed,
  normalizeVoiceCommand,
  resolveVoiceEngine,
} from './contracts'
import { createVoskController, type VoskRuntime } from './vosk'
import { readVoiceConfiguration } from './voice'

describe('voice command contract', () => {
  it.each([
    ['上', 'up'],
    [' 下 ', 'down'],
    ['左', 'left'],
    ['右', 'right'],
    ['确 认', 'confirm'],
  ] as const)('normalizes the exact Mandarin command %s', (spoken, expected) => {
    expect(normalizeVoiceCommand(spoken)).toBe(expected)
  })

  it.each(['上学', '下面', '左右', '确认一下', 'up', '', '[unk]'])(
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
  it('ships with the bundled Vosk model as the no-key default', () => {
    const configuration = readVoiceConfiguration()

    expect(configuration.selectedEngine).toBe('vosk')
    expect(configuration.config.voskModelPath).toBe(
      '/models/vosk-model-small-cn-0.22.tar',
    )
  })

  it('prefers the configured Vosk engine without requiring a key', () => {
    expect(resolveVoiceEngine('auto', { voskModelPath: '/models/cn.tar.gz' })).toBe('vosk')
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
  it('emits only strict commands and releases every microphone resource', async () => {
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

    resultListener?.({ result: { text: '上' } })
    resultListener?.({ result: { text: '上学' } })
    resultListener?.({ result: { text: '左右' } })

    expect(onCommand).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenCalledWith('up')
    expect(onState).toHaveBeenCalledWith('listening', '未听清，请再说一次')
    expect(onState).toHaveBeenCalledWith('fallback', '连续两次未听清，已显示方向按钮')

    const audioBuffer = {} as AudioBuffer
    processor.onaudioprocess?.({ inputBuffer: audioBuffer })
    expect(acceptWaveform).toHaveBeenCalledWith(audioBuffer)

    await controller?.stop()
    await controller?.stop()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(disconnectSource).toHaveBeenCalledOnce()
    expect(disconnectProcessor).toHaveBeenCalledOnce()
    expect(disconnectGain).toHaveBeenCalledOnce()
    expect(closeAudio).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
    expect(terminate).toHaveBeenCalledOnce()
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
    expect(terminate).toHaveBeenCalledOnce()
  })

  it.each([
    [new DOMException('missing', 'NotFoundError'), '没有检测到麦克风，已切换键盘模式'],
    [new Error('model corrupt'), '离线语音模型启动失败，已切换键盘模式'],
  ])('maps startup failures to a safe keyboard fallback', async (failure, detail) => {
    const onState = vi.fn()
    const runtime: VoskRuntime = {
      createModel: vi.fn().mockRejectedValue(failure),
      getUserMedia: vi.fn(),
      createAudioGraph: vi.fn(),
    }

    await expect(
      createVoskController('/models/cn.tar.gz', vi.fn(), onState, runtime),
    ).resolves.toBeNull()

    expect(onState).toHaveBeenLastCalledWith('error', detail)
  })
})
