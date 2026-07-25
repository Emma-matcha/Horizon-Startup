import { useCallback, useEffect, useRef, useState } from 'react'

import {
  isCommandAllowed,
  type VoiceCommand,
  type VoiceController,
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
  const activatingRef = useRef(false)
  const [state, setState] = useState<VoiceState>('idle')
  const [detail, setDetail] = useState('')
  const [engine, setEngine] = useState(readVoiceConfiguration().selectedEngine)

  useEffect(() => {
    callbackRef.current = onCommand
  }, [onCommand])

  useEffect(() => {
    scopeRef.current = scope
  }, [scope])

  const activate = useCallback(async () => {
    if (controllerRef.current || activatingRef.current) return
    activatingRef.current = true
    try {
      const controller = await createVoiceController(
        (command) => {
          if (isCommandAllowed(command, scopeRef.current)) callbackRef.current(command)
        },
        (nextState, nextDetail = '') => {
          setState(nextState)
          setDetail(nextDetail)
        },
      )
      controllerRef.current = controller
      if (controller) setEngine(controller.engine)
      else setEngine('keyboard')
    } finally {
      activatingRef.current = false
    }
  }, [])

  const stop = useCallback(async () => {
    const controller = controllerRef.current
    controllerRef.current = null
    if (controller) await controller.stop()
  }, [])

  useEffect(() => () => void stop(), [stop])

  return {
    activate,
    stop,
    state,
    detail,
    engine,
    configured: isVoiceConfigured(),
  }
}
