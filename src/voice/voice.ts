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
import { createVoskController } from './vosk'
import { createWebSpeechController, isWebSpeechAvailable } from './webSpeech'

const DEFAULT_VOSK_MODEL_PATH = '/models/vosk-model-small-cn-0.22.tar'

function parsePreference(value: string | undefined): VoiceEnginePreference {
  return value === 'vosk' || value === 'web-speech' || value === 'rhino' || value === 'keyboard'
    ? value
    : 'auto'
}

export function readVoiceConfiguration(): {
  config: VoiceEngineConfig
  preference: VoiceEnginePreference
  selectedEngine: VoiceEngineId
} {
  const config: VoiceEngineConfig = {
    voskModelPath: import.meta.env.VITE_VOSK_MODEL_PATH ?? DEFAULT_VOSK_MODEL_PATH,
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

  if (selectedEngine === 'vosk' && config.voskModelPath) {
    const controller = await createVoskController(config.voskModelPath, onCommand, onState)
    if (controller || preference !== 'auto') return controller
  }

  if (
    preference === 'web-speech' ||
    ((selectedEngine === 'web-speech' || preference === 'auto') &&
      config.webSpeechAvailable)
  ) {
    const controller = await createWebSpeechController(onCommand, onState)
    if (controller || preference !== 'auto') return controller
  }

  const canUseRhino = Boolean(
    config.rhinoAccessKey && config.rhinoContextPath && config.rhinoModelPath,
  )
  if ((selectedEngine === 'rhino' || preference === 'auto') && canUseRhino) {
    return createRhinoController(onCommand, onState)
  }

  onState('unavailable', '离线语音未就绪，键盘方向键可完整测试')
  return null
}
