import {
  resolveVoiceEngine,
  type VoiceCommand,
  type VoiceController,
  type VoiceEngineConfig,
  type VoiceEngineId,
  type VoiceEnginePreference,
  type VoiceState,
} from './contracts'
import { createRhinoController } from './rhino'
import { resolveEmbeddedVoskModelPath } from './embeddedModel'
import { createVoskController } from './vosk'
import { createWebSpeechController, isWebSpeechAvailable } from './webSpeech'

const DEFAULT_VOSK_MODEL_PATH = '/models/vosk-model-small-cn-0.22.manifest.json'

export function canUseBundledVosk(protocol: string): boolean {
  return protocol !== 'file:'
}

function parsePreference(value: string | undefined): VoiceEnginePreference {
  return value === 'vosk' || value === 'web-speech' || value === 'rhino' || value === 'keyboard'
    ? value
    : value === 'auto'
      ? 'auto'
      : 'vosk'
}

export function readVoiceConfiguration(): {
  config: VoiceEngineConfig
  preference: VoiceEnginePreference
  selectedEngine: VoiceEngineId
} {
  const protocol = typeof location === 'undefined' ? 'http:' : location.protocol
  const config: VoiceEngineConfig = {
    voskModelPath: canUseBundledVosk(protocol)
      ? (import.meta.env.VITE_VOSK_MODEL_PATH ?? DEFAULT_VOSK_MODEL_PATH)
      : undefined,
    webSpeechAvailable: isWebSpeechAvailable(),
    rhinoAccessKey: import.meta.env.VITE_PICOVOICE_ACCESS_KEY,
    rhinoContextPath: import.meta.env.VITE_RHINO_CONTEXT_PATH,
    rhinoModelPath: import.meta.env.VITE_RHINO_MODEL_PATH,
  }
  const preference = parsePreference(import.meta.env.VITE_VOICE_ENGINE)
  return { config, preference, selectedEngine: resolveVoiceEngine(preference, config) }
}

export function isVoiceConfigured(): boolean {
  return readVoiceConfiguration().selectedEngine !== 'keyboard'
}

export async function createVoiceController(
  onCommand: (command: VoiceCommand) => void,
  onState: (state: VoiceState, detail?: string) => void,
  preferenceOverride?: VoiceEnginePreference,
): Promise<VoiceController | null> {
  const configuration = readVoiceConfiguration()
  const config = configuration.config
  const preference = preferenceOverride ?? configuration.preference
  const selectedEngine = resolveVoiceEngine(preference, config)

  const startVosk = async () => {
    if (!config.voskModelPath) return null
    try {
      onState('loading', '正在加载离线语音模型 · 首次约需 30–60 秒')
      const modelPath = await resolveEmbeddedVoskModelPath(config.voskModelPath)
      return createVoskController(modelPath, onCommand, onState)
    } catch {
      onState('fallback', '离线语音模型启动失败，已切换键盘模式')
      return null
    }
  }

  if (preference === 'web-speech') {
    return config.webSpeechAvailable
      ? createWebSpeechController(onCommand, onState)
      : null
  }

  if (preference === 'vosk') return startVosk()

  const canUseRhino = Boolean(
    config.rhinoAccessKey && config.rhinoContextPath && config.rhinoModelPath,
  )

  if (preference === 'rhino') {
    return canUseRhino
      ? createRhinoController(onCommand, onState)
      : null
  }

  if (preference === 'auto' && config.webSpeechAvailable) {
    const controller = await createWebSpeechController(onCommand, onState)
    if (controller) return controller
  }

  if (preference === 'auto' && config.voskModelPath) {
    const controller = await startVosk()
    if (controller) return controller
  }

  if (preference === 'auto' && canUseRhino) {
    return createRhinoController(onCommand, onState)
  }

  if (selectedEngine === 'keyboard') {
    onState('unavailable', '语音未就绪，键盘方向键可完整测试')
  }
  return null
}
