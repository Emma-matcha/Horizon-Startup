import { expect, test } from '@playwright/test'

import { VisionPage } from './pages/VisionPage'

test('home presents the approved photoreal red-house direction', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()

  await expect(page.locator('.home__scene')).toHaveCSS(
    'background-image',
    /church-meadow-hero\.jpg/,
  )
  await expect(page.getByText(/不能替代专业眼科检查/)).toBeVisible()
  await expect(page.getByText(/Windows 10\/11 或 macOS/)).toBeVisible()
  await page.screenshot({ path: 'docs/design/qa/08-live-home.png' })
})

test('offers physical screen calibration for Windows displays', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()

  await expect(page.getByText('Windows 显示缩放 100%')).toBeVisible()
  await expect(page.getByText(/不依赖屏幕型号或分辨率/)).toBeVisible()
  await page.getByRole('button', { name: '缩短校准线' }).click({ clickCount: 31 })
  await expect(page.getByRole('status')).toHaveText('158 px')
})

test('starts the disclosed online voice fallback when Chrome exposes Web Speech', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false
      interimResults = true
      lang = ''
      maxAlternatives = 0
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      onnomatch: (() => void) | null = null
      onresult: (() => void) | null = null
      onstart: (() => void) | null = null

      start() {
        queueMicrotask(() => this.onstart?.())
      }

      abort() {}
    }

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    })
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: MockSpeechRecognition,
    })
  })

  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()

  await page.getByRole('button', { name: '使用在线语音备用' }).click()
  await expect(page.getByRole('button', { name: '在线语音备用已开启' })).toBeVisible()
  await expect(page.getByText(/语音可能由浏览器服务处理/)).toBeVisible()
})

test('completes right and left eye screening and stores a report', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()
  await app.startEye()
  await app.finishEyeWithCorrectAnswers()

  await expect(page.getByRole('heading', { name: '现在交换遮挡' })).toBeVisible()
  await app.startEye()
  await app.finishEyeWithCorrectAnswers()

  await expect(page.getByRole('heading', { name: /看见变化/ })).toBeVisible()
  await expect(page.locator('.score-pair strong')).toHaveText(['5.2', '5.2'])
  await expect(page.locator('#main-content')).toHaveCSS('filter', 'blur(0px)')
  await page.screenshot({
    path: 'docs/design/qa/09-live-report.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: /查看详情/ }).click()
  await expect(page.getByRole('heading', { name: '视力变化记录' })).toBeVisible()
  await expect(page.getByText('本次记录')).toBeVisible()
})
