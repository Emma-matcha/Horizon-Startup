import type { Direction } from '../domain/optotype'

export type VoiceCommand = Direction | 'confirm'
export type VoiceEngineId = 'vosk' | 'web-speech' | 'rhino' | 'keyboard'
export type VoiceEnginePreference = VoiceEngineId | 'auto'
export type VoiceScope = 'distance-confirmation' | 'direction-test'
export type VoiceState =
  | 'idle'
  | 'loading'
  | 'listening'
  | 'fallback'
  | 'unavailable'
  | 'error'

export interface VoiceController {
  readonly engine: Exclude<VoiceEngineId, 'keyboard'>
  stop: () => Promise<void>
}

export interface VoiceEngineConfig {
  voskModelPath?: string
  webSpeechAvailable?: boolean
  rhinoAccessKey?: string
  rhinoContextPath?: string
  rhinoModelPath?: string
}

const commandMap: Record<string, VoiceCommand> = {
  上: 'up',
  下: 'down',
  左: 'left',
  右: 'right',
  确认: 'confirm',
}

export function normalizeVoiceCommand(spoken: string): VoiceCommand | null {
  const compact = spoken.replace(/\s+/g, '')
  return commandMap[compact] ?? null
}

export function isCommandAllowed(command: VoiceCommand, scope: VoiceScope): boolean {
  return scope === 'distance-confirmation' ? command === 'confirm' : command !== 'confirm'
}

export function resolveVoiceEngine(
  preference: VoiceEnginePreference,
  config: VoiceEngineConfig,
): VoiceEngineId {
  const hasVosk = Boolean(config.voskModelPath)
  const hasRhino = Boolean(
    config.rhinoAccessKey && config.rhinoContextPath && config.rhinoModelPath,
  )

  if (preference === 'keyboard') return 'keyboard'
  if (preference === 'vosk') return hasVosk ? 'vosk' : 'keyboard'
  if (preference === 'web-speech') {
    return config.webSpeechAvailable ? 'web-speech' : 'keyboard'
  }
  if (preference === 'rhino') return hasRhino ? 'rhino' : 'keyboard'
  if (hasVosk) return 'vosk'
  if (config.webSpeechAvailable) return 'web-speech'
  if (hasRhino) return 'rhino'
  return 'keyboard'
}
