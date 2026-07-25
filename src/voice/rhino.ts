import type { Direction } from '../domain/optotype'
import type { VoiceCommand, VoiceController, VoiceState } from './contracts'

export type { VoiceCommand, VoiceController, VoiceState } from './contracts'

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
    let consecutiveRejected = 0
    const [{ RhinoWorker }, { WebVoiceProcessor }] = await Promise.all([
      import('@picovoice/rhino-web'),
      import('@picovoice/web-voice-processor'),
    ])
    const rhino = await RhinoWorker.create(
      accessKey,
      { publicPath: contextPath, sensitivity: 0.62 },
      (inference) => {
        if (!inference.isFinalized) return
        if (!inference.isUnderstood) {
          consecutiveRejected += 1
          onState(
            consecutiveRejected >= 2 ? 'fallback' : 'listening',
            consecutiveRejected >= 2
              ? '连续两次未听清，已显示方向按钮'
              : '未听清，请再说一次',
          )
          rhino.reset()
          return
        }
        const spokenDirection = inference.slots?.direction
        if (spokenDirection && directionMap[spokenDirection]) {
          consecutiveRejected = 0
          onState('listening')
          onCommand(directionMap[spokenDirection])
        } else if (inference.intent === 'confirm') {
          consecutiveRejected = 0
          onState('listening')
          onCommand('confirm')
        } else {
          consecutiveRejected += 1
          onState(
            consecutiveRejected >= 2 ? 'fallback' : 'listening',
            consecutiveRejected >= 2
              ? '连续两次未听清，已显示方向按钮'
              : '未听清，请再说一次',
          )
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
      engine: 'rhino',
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
