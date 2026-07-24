import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createRhinoController,
  isRhinoConfigured,
  type VoiceCommand,
  type VoiceController,
  type VoiceState,
} from './rhino'

export function useRhinoVoice(onCommand: (command: VoiceCommand) => void) {
  const callbackRef = useRef(onCommand)
  const controllerRef = useRef<VoiceController | null>(null)
  const [state, setState] = useState<VoiceState>('idle')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    callbackRef.current = onCommand
  }, [onCommand])

  const activate = useCallback(async () => {
    if (controllerRef.current || state === 'loading') return
    const controller = await createRhinoController(
      (command) => callbackRef.current(command),
      (nextState, nextDetail = '') => {
        setState(nextState)
        setDetail(nextDetail)
      },
    )
    controllerRef.current = controller
  }, [state])

  const stop = useCallback(async () => {
    const controller = controllerRef.current
    controllerRef.current = null
    if (controller) await controller.stop()
  }, [])

  useEffect(() => () => void stop(), [stop])

  return { activate, stop, state, detail, configured: isRhinoConfigured() }
}
