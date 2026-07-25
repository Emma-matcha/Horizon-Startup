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

test('renders a fresh same-size life word beneath each optotype', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()

  await expect(page.getByRole('heading', { name: '生活单词参考' })).toBeVisible()
  await expect(page.getByText(/不会参与评分/)).toBeVisible()
  await app.startEye()

  const mark = page.locator('.optotype')
  const word = page.locator('.reference-word')
  await expect(word).toBeVisible()
  const firstWord = await word.textContent()
  const dimensions = await Promise.all([
    mark.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width)),
    word.evaluate((element) => Number.parseFloat((element as HTMLElement).style.fontSize)),
  ])
  expect(dimensions[1]).toBe(dimensions[0])

  await app.answerCurrentDirection()
  await expect(word).not.toHaveText(firstWord ?? '')
})

test('persists the home gear switch and hides reference words when disabled', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()

  await page.getByRole('button', { name: '打开设置' }).click()
  const toggle = page.getByRole('switch', { name: '显示生活参考词' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: '关闭设置' }).click()

  await page.reload()
  await page.getByRole('button', { name: '打开设置' }).click()
  await expect(page.getByRole('switch', { name: '显示生活参考词' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await page.getByRole('button', { name: '关闭设置' }).click()

  await app.enterScreening()
  await expect(page.getByRole('button', { name: '打开设置' })).toHaveCount(0)
  await app.startEye()
  await expect(page.locator('.reference-word')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('red-house-vision:preferences:v1'))).toContain(
    '"referenceWordsEnabled":false',
  )
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
