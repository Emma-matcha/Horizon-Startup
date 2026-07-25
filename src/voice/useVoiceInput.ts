import { useCallback, useEffect, useRef, useState } from 'react'

import {
  isCommandAllowed,
  type VoiceCommand,
  type VoiceController,
  type VoiceEnginePreference,
  type VoiceScope,
  type VoiceState,
} from './contracts'
import { createVoiceController, isVoiceConfigured, readVoiceConfiguration } from './voice'

export function useVoiceInput(
  onCommand: (command: VoiceCommand) => void,
  scope: VoiceScope,
) {
  const callbackRef = useRef(onCommand)
  const scopeRef = useRef(scope)
  const controllerRef = useRef<VoiceController | null>(null)
  const activationIdRef = useRef(0)
  const [state, setState] = useState<VoiceState>('idle')
  const [detail, setDetail] = useState('')
  const [engine, setEngine] = useState(readVoiceConfiguration().selectedEngine)

  useEffect(() => {
    callbackRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    scopeRef.current = scope
  }, [scope])

  const activate = useCallback(async (preference?: VoiceEnginePreference) => {
    const activationId = activationIdRef.current + 1
    activationIdRef.current = activationId
    const previousController = controllerRef.current
    controllerRef.current = null
    if (previousController) await previousController.stop()
    const controller = await createVoiceController(
      (command) => {
        if (
          activationId === activationIdRef.current &&
          isCommandAllowed(command, scopeRef.current)
        ) {
          callbackRef.current(command)
        }
      },
      (nextState, nextDetail = '') => {
        if (activationId !== activationIdRef.current) return
        setState(nextState)
        setDetail(nextDetail)
      },
      preference,
    )

    if (activationId !== activationIdRef.current) {
      await controller?.stop()
      return
    }
    controllerRef.current = controller
    if (controller) setEngine(controller.engine)
    else setEngine('keyboard')
  }, [])

  const stop = useCallback(async () => {
    activationIdRef.current += 1
    const controller = controllerRef.current
    controllerRef.current = null
    if (controller) await controller.stop()
  }, [])

  const pause = useCallback(async () => {
    await controllerRef.current?.pause()
  }, [])

  const resume = useCallback(async () => {
    await controllerRef.current?.resume()
  }, [])

  const clearTransientFeedback = useCallback(() => {
    setState((current) =>
      current === 'fallback' && controllerRef.current ? 'listening' : current,
    )
    setDetail((current) =>
      current.startsWith('已听到') || current.startsWith('没听清') ? '' : current,
    )
  }, [])

  useEffect(() => () => void stop(), [stop])

  return {
    activate,
    pause,
    resume,
    clearTransientFeedback,
    stop,
    state,
    detail,
    engine,
    configured: isVoiceConfigured(),
  }
}
