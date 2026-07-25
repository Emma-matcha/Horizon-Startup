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
      screen.getByText(/在线备用可能将语音发送给浏览器的识别服务/),
    ).toBeInTheDocument()
  })
})
