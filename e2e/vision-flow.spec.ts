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

test('opens the bundled offline microphone from the locally served single HTML', async ({ page }) => {
  test.setTimeout(90_000)
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      externalRequests.push(request.url())
    }
  })
  const app = new VisionPage(page)
  await app.goto('/red-house-vision.html?test=1')
  await app.enterScreening()

  await page.getByRole('button', { name: '打开离线麦克风' }).click()
  await expect(page.getByRole('button', { name: /麦克风已打开/ })).toBeVisible({ timeout: 5_000 })
  await expect(page.getByRole('button', { name: 'Vosk 本地语音已开启' })).toBeVisible({
    timeout: 70_000,
  })
  expect(externalRequests).toEqual([])
})

test('renders a fresh physically matched English word beneath each optotype', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()

  await expect(page.getByRole('heading', { name: '英文单词参考' })).toBeVisible()
  await expect(page.getByText(/不会参与评分/)).toBeVisible()
  await app.startEye()

  const word = page.locator('.reference-word')
  await expect(word).toBeVisible()
  let previousWord = ''
  for (let levelIndex = 0; levelIndex < 7; levelIndex += 1) {
    await expect(word).toHaveText(/^[a-z]{3,6}$/)
    await expect(word).not.toHaveText(previousWord)
    const dimensions = await word.evaluate((element) => {
      const style = getComputedStyle(element)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas text metrics unavailable')
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const metrics = context.measureText(element.textContent ?? '')
      const optotype = document.querySelector<HTMLElement>('.optotype')
      return {
        glyphInkHeight: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
        optotypeEdge: Number.parseFloat(optotype?.style.width ?? ''),
        targetHeight: Number.parseFloat((element as HTMLElement).dataset.targetHeight ?? ''),
      }
    })
    expect(dimensions.targetHeight).toBeCloseTo(dimensions.optotypeEdge, 3)
    expect(dimensions.glyphInkHeight).toBeCloseTo(dimensions.targetHeight, 1)
    previousWord = (await word.textContent()) ?? ''
    if (levelIndex < 6) await app.answerCurrentDirection()
  }
})

test('persists the home gear switch and hides reference words when disabled', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()

  await page.getByRole('button', { name: '打开设置' }).click()
  const toggle = page.getByRole('switch', { name: '显示英文参考词' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: '关闭设置' }).click()

  await page.reload()
  await page.getByRole('button', { name: '打开设置' }).click()
  await expect(page.getByRole('switch', { name: '显示英文参考词' })).toHaveAttribute(
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
