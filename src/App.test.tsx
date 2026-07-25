import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'

describe('Red House app', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('states the non-diagnostic boundary on the home page', () => {
    render(<App />)

    const interiorWindow = document.querySelector('.home__interior-window')
    expect(interiorWindow).toBeInTheDocument()
    expect(interiorWindow?.children).toHaveLength(0)
    expect(document.querySelector('.home__house')).toBeInTheDocument()
    expect(document.querySelector('.home__paper-world')).toBeInTheDocument()
    expect(document.querySelector('.home__paper-hill--back')).toBeInTheDocument()
    expect(document.querySelector('.home__paper-hill--front')).toBeInTheDocument()
    expect(document.querySelector('.home__paper-path')).not.toBeInTheDocument()
    expect(document.querySelector('.home__paper-rings')).not.toBeInTheDocument()
    expect(document.querySelector('.home__paper-foliage')).not.toBeInTheDocument()
    const title = screen.getByRole('heading', { name: 'Red House' })
    const tagline = screen.getByText('关注视力好帮手！')
    const startButton = screen.getByRole('button', { name: '开始' })
    expect(title).toBeInTheDocument()
    expect(tagline).toHaveClass('home__tagline')
    expect(title.compareDocumentPosition(tagline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tagline.compareDocumentPosition(startButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(/不能替代专业眼科检查/)).toBeInTheDocument()
    expect(screen.queryByText(/两米 · 双眼分测/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Windows 10\/11/)).not.toBeInTheDocument()
    expect(screen.queryByText('红房子')).not.toBeInTheDocument()
  })

  it('offers a home-only gear setting and persists the reference-word switch', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开设置' }))
    const toggle = screen.getByRole('switch', { name: '显示英文参考词' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(localStorage.getItem('red-house-vision:preferences:v1')).toContain(
      '"referenceWordsEnabled":false',
    )

    const soundToggle = screen.getByRole('switch', { name: '播放答题音效' })
    expect(soundToggle).toHaveAttribute('aria-checked', 'true')
    await user.click(soundToggle)
    expect(soundToggle).toHaveAttribute('aria-checked', 'false')
    expect(localStorage.getItem('red-house-vision:preferences:v1')).toContain(
      '"feedbackSoundsEnabled":false',
    )
  })

  it('separates distance confirmation from right-eye preparation', async () => {
    window.history.replaceState({}, '', '/?voice=keyboard&test=1')
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始' }))
    await user.click(screen.getByRole('button', { name: '同意并继续' }))

    expect(screen.getByRole('heading', { name: '站到 2 米' })).toBeInTheDocument()
    expect(screen.queryByText('先测试右眼')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /开始测试/ })).not.toBeInTheDocument()
    expect(document.querySelector('.setup-measure-track')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('heading', { name: '测试右眼' })).toBeInTheDocument()
    expect(screen.getByText('遮住左眼')).toBeInTheDocument()
    expect(document.querySelector('.eye-guide-arrow--right')).toBeInTheDocument()
    expect(document.querySelectorAll('svg.eye-guide-eye')).toHaveLength(0)
    const eyes = Array.from(document.querySelectorAll('.eye-guide-eye'))
    expect(eyes).toHaveLength(2)
    expect(eyes.map((element) => element.textContent)).toEqual(['👁️', '👁️'])

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('右眼 · 保持两米')).toBeInTheDocument()

    const level = await screen.findByLabelText('当前视力级别 4.6')
    expect(level).toHaveClass('optotype-level')
    expect(level.parentElement).toHaveClass('test-meta')
    expect(document.querySelector('.reference-word-group')).toBeInTheDocument()
    const english = document.querySelector('.reference-word') as HTMLElement
    const chinese = document.querySelector('.reference-word-meaning') as HTMLElement
    expect(english).toHaveTextContent(/^[a-z]+$/)
    expect(chinese).toHaveTextContent(/\S+/)
    const sharedInlineStyle = (element: HTMLElement) => [
      element.style.color,
      element.style.fontFamily,
      element.style.fontSize,
      element.style.fontWeight,
      element.style.letterSpacing,
    ]
    expect(sharedInlineStyle(english).every(Boolean)).toBe(true)
    expect(sharedInlineStyle(chinese)).toEqual(sharedInlineStyle(english))
  })

  it('requires local-data consent before setup', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '同意并继续' }))
    expect(screen.getByRole('heading', { name: '站到 2 米' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('discloses that the online fallback can send audio to the browser service', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始' }))

    expect(
      screen.getByText(/在线备用可能由浏览器处理音频/),
    ).toBeInTheDocument()
  })

  it('keeps settings and local profile visually terse', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开设置' }))
    expect(screen.getByRole('heading', { name: '显示' })).toBeInTheDocument()
    expect(screen.queryByText('测试显示设置')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '关闭设置' }))

    await user.click(screen.getByRole('button', { name: '登录' }))
    expect(screen.getByRole('heading', { name: '档案' })).toBeInTheDocument()
    expect(screen.queryByText(/本次 MVE/)).not.toBeInTheDocument()
  })
})
