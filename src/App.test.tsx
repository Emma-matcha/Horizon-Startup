import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'

describe('Red House app', () => {
  beforeEach(() => localStorage.clear())

  it('states the non-diagnostic boundary on the home page', () => {
    render(<App />)

    expect(screen.getByText(/家庭视力筛查与趋势跟踪/)).toBeInTheDocument()
    expect(screen.getByText(/不能替代专业眼科检查/)).toBeInTheDocument()
    expect(screen.getByText(/Windows 10\/11 或 macOS/)).toBeInTheDocument()
  })

  it('offers a home-only gear setting and persists the reference-word switch', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '打开设置' }))
    const toggle = screen.getByRole('switch', { name: '显示生活参考词' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(localStorage.getItem('red-house-vision:preferences:v1')).toContain(
      '"referenceWordsEnabled":false',
    )
  })

  it('supports physical calibration for Windows displays', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始筛查' }))
    await user.click(screen.getByRole('button', { name: '同意并继续' }))

    expect(screen.getByText('Windows 显示缩放 100%')).toBeInTheDocument()
    expect(screen.getByText(/不依赖屏幕型号或分辨率/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '生活单词参考' })).toBeInTheDocument()
    expect(screen.getByText(/与 E 字视标使用完全相同的尺寸数值/)).toBeInTheDocument()
    expect(screen.getByText(/不会参与评分/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '打开设置' })).not.toBeInTheDocument()

    const shrink = screen.getByRole('button', { name: '缩短校准线' })
    for (let click = 0; click < 31; click += 1) await user.click(shrink)
    expect(screen.getByRole('status')).toHaveTextContent('158 px')
  })

  it('requires local-data consent before setup', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始筛查' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '同意并继续' }))
    expect(screen.getByRole('heading', { name: '先量好两米' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '使用在线语音备用' }),
    ).toBeInTheDocument()
  })

  it('discloses that the online fallback can send audio to the browser service', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '开始筛查' }))

    expect(
      screen.getByText(/在线语音备用，音频可能发送给浏览器识别服务/),
    ).toBeInTheDocument()
  })
})
