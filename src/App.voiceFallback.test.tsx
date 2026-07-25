import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

const voice = vi.hoisted(() => ({
  onCommand: undefined as ((command: 'up' | 'down' | 'left' | 'right' | 'confirm') => void) | undefined,
  activate: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  clearTransientFeedback: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
  state: 'listening' as 'listening' | 'loading' | 'fallback',
  detail: '',
  engine: 'vosk' as 'vosk' | 'keyboard',
}))

vi.mock('./voice/useVoiceInput', () => ({
  useVoiceInput: (onCommand: NonNullable<typeof voice.onCommand>) => {
    voice.onCommand = onCommand
    return {
      activate: voice.activate,
      pause: voice.pause,
      resume: voice.resume,
      clearTransientFeedback: voice.clearTransientFeedback,
      stop: voice.stop,
      state: voice.state,
      detail: voice.detail,
      engine: voice.engine,
      configured: true,
    }
  },
}))

describe('offline voice fallback', () => {
  beforeEach(() => {
    localStorage.clear()
    voice.activate.mockClear()
    voice.pause.mockClear()
    voice.resume.mockClear()
    voice.clearTransientFeedback.mockClear()
    voice.stop.mockClear()
    voice.state = 'listening'
    voice.detail = ''
    voice.engine = 'vosk'
    voice.onCommand = undefined
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }))
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps a listening Vosk controller instead of replacing it with online speech', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))
    voice.activate.mockClear()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(
      screen.getByText('离线语音已就绪 · 说“准备好了”'),
    ).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000)
    })

    expect(voice.activate).not.toHaveBeenCalledWith('web-speech')
  })

  it('shows confirmation feedback on setup and eye-guide pages', async () => {
    voice.detail = '已听到：准备好了'
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(screen.getByRole('status')).toHaveTextContent('已听到：准备好了')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent('正在播报提示')
  })

  it('uses voice-only setup UI and gates listening until prompt playback settles', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))

    expect(screen.queryByRole('button', { name: /开始测试/ })).not.toBeInTheDocument()
    expect(voice.pause).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('正在播报提示')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(voice.resume).toHaveBeenCalledOnce()
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.getByText('测试右眼')).toBeInTheDocument()
  })

  it('rejects a confirmation delivered synchronously while prompt pause starts', async () => {
    voice.pause.mockImplementationOnce(async () => {
      voice.onCommand?.('confirm')
    })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(screen.getByRole('heading', { name: '站到 2 米' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '测试右眼' })).not.toBeInTheDocument()
  })

  it('does not start the eye test while the offline model is still loading', () => {
    voice.state = 'loading'
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))

    expect(screen.queryByRole('button', { name: /开始测试/ })).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('heading', { name: '站到 2 米' })).toBeInTheDocument()
  })

  it('uses confirmation-specific missed copy on setup and eye-guide pages', () => {
    voice.state = 'fallback'
    voice.detail = '没听清 · 请重新说当前方向'
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      '没听清 · 请再说“准备好了”',
    )
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent(
      '没听清 · 请再说“准备好了”',
    )
  })

  it('keeps transient not-heard feedback separate from keyboard fallback', async () => {
    voice.state = 'fallback'
    voice.detail = '没听清 · 请重新说当前方向'
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'Enter' })

    for (let step = 0; step < 4; step += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_100)
      })
    }
    const optotype = document.querySelector('.optotype--animated')
    expect(optotype).not.toBeNull()
    fireEvent.animationEnd(optotype as Element)

    expect(screen.getByText('没听清 · 请重新说当前方向')).toBeInTheDocument()
    expect(screen.queryByLabelText('方向回答')).not.toBeInTheDocument()
  })
})
