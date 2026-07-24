import type { Direction } from '../domain/optotype'

export type VoiceCommand = Direction | 'confirm'
export type VoiceState = 'idle' | 'loading' | 'listening' | 'unavailable' | 'error'

export interface VoiceController {
  stop: () => Promise<void>
}

const directionMap: Record<string, Direction> = {
  上: 'up',
  右: 'right',
  下: 'down',
  左: 'left',
  up: 'up',
  right: 'right',
  down: 'down',
  left: 'left',
}

export function isRhinoConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_PICOVOICE_ACCESS_KEY &&
      import.meta.env.VITE_RHINO_CONTEXT_PATH &&
      import.meta.env.VITE_RHINO_MODEL_PATH,
  )
}

export async function createRhinoController(
  onCommand: (command: VoiceCommand) => void,
  onState: (state: VoiceState, detail?: string) => void,
): Promise<VoiceController | null> {
  const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY
  const contextPath = import.meta.env.VITE_RHINO_CONTEXT_PATH
  const modelPath = import.meta.env.VITE_RHINO_MODEL_PATH
  if (!accessKey || !contextPath || !modelPath) {
    onState('unavailable', '未配置离线语音模型，键盘模式仍可完整测试')
    return null
  }

  onState('loading')
  try {
    const [{ RhinoWorker }, { WebVoiceProcessor }] = await Promise.all([
      import('@picovoice/rhino-web'),
      import('@picovoice/web-voice-processor'),
    ])
    const rhino = await RhinoWorker.create(
      accessKey,
      { publicPath: contextPath, sensitivity: 0.62 },
      (inference) => {
        if (!inference.isFinalized || !inference.isUnderstood) return
        const spokenDirection = inference.slots?.direction
        if (spokenDirection && directionMap[spokenDirection]) {
          onCommand(directionMap[spokenDirection])
        } else if (inference.intent === 'confirm') {
          onCommand('confirm')
        }
        rhino.reset()
      },
      { publicPath: modelPath },
      {
        endpointDurationSec: 0.7,
        requireEndpoint: true,
        processErrorCallback: () => onState('error', '语音处理暂时中断'),
      },
    )
    WebVoiceProcessor.setOptions({
      frameLength: rhino.frameLength,
      outputSampleRate: rhino.sampleRate,
    })
    await WebVoiceProcessor.subscribe(rhino)
    onState('listening')

    return {
      stop: async () => {
        await WebVoiceProcessor.unsubscribe(rhino)
        await rhino.release()
        rhino.terminate()
        onState('idle')
      },
    }
  } catch {
    onState('error', '无法启用麦克风或离线语音模型')
    return null
  }
}
