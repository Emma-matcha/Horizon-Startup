import { describe, expect, it, vi } from 'vitest'

import {
  createWebSpeechController,
  type WebSpeechRecognitionLike,
  type WebSpeechRuntime,
} from './webSpeech'

function createRecognition(): WebSpeechRecognitionLike {
  return {
    continuous: false,
    interimResults: true,
    lang: '',
    maxAlternatives: 0,
    onend: null,
    onerror: null,
    onnomatch: null,
    onresult: null,
    onstart: null,
    abort: vi.fn(),
    start: vi.fn(),
  }
}

function createRuntime(recognition: WebSpeechRecognitionLike | null): WebSpeechRuntime {
  return {
    createRecognition: () => recognition,
    isOnline: () => true,
    scheduleRestart: vi.fn(() => 7),
    cancelRestart: vi.fn(),
  }
}

describe('Web Speech online fallback', () => {
  it('starts zh-CN recognition and emits only a strict final command', async () => {
    const recognition = createRecognition()
    const runtime = createRuntime(recognition)
    const onCommand = vi.fn()
    const onState = vi.fn()

    const controller = await createWebSpeechController(onCommand, onState, runtime)

    expect(recognition.lang).toBe('zh-CN')
    expect(recognition.continuous).toBe(true)
    expect(recognition.interimResults).toBe(false)
    expect(recognition.maxAlternatives).toBe(1)
    expect(recognition.start).toHaveBeenCalledOnce()

    recognition.onstart?.()
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: ' 上 ' } }],
    })
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: '上学' } }],
    })

    expect(onCommand).toHaveBeenCalledOnce()
    expect(onCommand).toHaveBeenCalledWith('up')
    expect(onState).toHaveBeenCalledWith(
      'listening',
      '在线语音备用已开启 · 语音可能由浏览器服务处理',
    )

    await controller?.stop()
    await controller?.stop()
    expect(recognition.abort).toHaveBeenCalledOnce()
    expect(onState).toHaveBeenLastCalledWith('idle')
  })

  it('shows mouse fallback only after two rejected online results', async () => {
    const recognition = createRecognition()
    const onState = vi.fn()
    await createWebSpeechController(vi.fn(), onState, createRuntime(recognition))

    recognition.onnomatch?.()
    recognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: '确认一下' } }],
    })

    expect(onState).toHaveBeenCalledWith('listening', '未听清，请再说一次')
    expect(onState).toHaveBeenLastCalledWith(
      'fallback',
      '连续两次未听清，已显示方向按钮',
    )
  })

  it('maps network failure without exposing browser error details', async () => {
    const recognition = createRecognition()
    const onState = vi.fn()
    await createWebSpeechController(vi.fn(), onState, createRuntime(recognition))

    recognition.onerror?.({ error: 'network', message: 'internal vendor endpoint' })

    expect(onState).toHaveBeenLastCalledWith(
      'error',
      '在线语音连接失败，键盘方向键仍可使用',
    )
  })

  it('restarts after a normal service end but never after stop', async () => {
    const recognition = createRecognition()
    const runtime = createRuntime(recognition)
    let restart: (() => void) | undefined
    runtime.scheduleRestart = vi.fn((callback) => {
      restart = callback
      return 9
    })
    const controller = await createWebSpeechController(vi.fn(), vi.fn(), runtime)

    recognition.onend?.()
    restart?.()
    expect(recognition.start).toHaveBeenCalledTimes(2)

    await controller?.stop()
    recognition.onend?.()
    expect(runtime.cancelRestart).toHaveBeenCalledWith(9)
    expect(runtime.scheduleRestart).toHaveBeenCalledOnce()
  })

  it('fails safely when offline or unsupported', async () => {
    const offlineState = vi.fn()
    const offlineRuntime = createRuntime(createRecognition())
    offlineRuntime.isOnline = () => false
    await expect(
      createWebSpeechController(vi.fn(), offlineState, offlineRuntime),
    ).resolves.toBeNull()
    expect(offlineState).toHaveBeenLastCalledWith(
      'unavailable',
      '当前没有网络，无法启用在线语音备用',
    )

    const unsupportedState = vi.fn()
    await expect(
      createWebSpeechController(vi.fn(), unsupportedState, createRuntime(null)),
    ).resolves.toBeNull()
    expect(unsupportedState).toHaveBeenLastCalledWith(
      'unavailable',
      '当前浏览器不支持在线语音，键盘方向键仍可使用',
    )
  })
})
