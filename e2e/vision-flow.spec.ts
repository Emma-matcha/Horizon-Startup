import { expect, test, type Page } from '@playwright/test'

import { VisionPage } from './pages/VisionPage'

async function expectCenteredEyeGuide(page: Page, coverText: string, testText: string) {
  const visual = page.locator('.eye-guide-visual')
  const cover = page.getByText(coverText)
  const testHeading = page.getByRole('heading', { name: testText })
  const [visualBox, coverBox, testBox, viewport] = await Promise.all([
    visual.boundingBox(),
    cover.boundingBox(),
    testHeading.boundingBox(),
    page.viewportSize(),
  ])

  expect(visualBox).not.toBeNull()
  expect(coverBox).not.toBeNull()
  expect(testBox).not.toBeNull()
  expect(visualBox!.x + visualBox!.width / 2).toBeCloseTo((viewport?.width ?? 0) / 2, 0)
  expect(visualBox!.y + visualBox!.height / 2).toBeCloseTo((viewport?.height ?? 0) / 2, 0)
  expect(coverBox!.y + coverBox!.height).toBeLessThan(visualBox!.y)
  expect(testBox!.y).toBeGreaterThan(visualBox!.y + visualBox!.height)
  await expect(page.locator('.eye-guide-eye')).toHaveCount(2)
  await expect(page.locator('.eye-guide-eye').first()).toHaveText('👁️')
}

test('home presents a compact house, sparse copy and cinematic intro', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()

  const house = page.locator('.home__house')
  const interior = page.locator('.home__interior')
  const interiorWindow = page.locator('.home__interior-window')
  await expect(interiorWindow).toBeAttached()
  await expect(interior).toHaveCSS('background-color', 'rgb(74, 13, 15)')
  await expect(interior).toHaveCSS('background-image', 'none')
  await expect(page.locator('.home__interior-glow')).toHaveCSS('background-image', 'none')
  await expect(page.locator('.home__interior-wall').first()).toHaveCSS('background-image', 'none')
  await expect(page.locator('.home__paper-world')).toBeVisible()
  await expect(page.locator('.home__paper-hill--back')).toBeVisible()
  await expect(page.locator('.home__paper-hill--front')).toBeVisible()
  await expect(page.locator('.home__paper-path')).toHaveCount(0)
  await expect(page.locator('.home__paper-rings')).toHaveCount(0)
  await expect(page.locator('.home__paper-foliage')).toHaveCount(0)
  const paperPalette = await page.locator(':root').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      sky: style.getPropertyValue('--paper-sky').trim(),
      grass: style.getPropertyValue('--paper-grass').trim(),
      red: style.getPropertyValue('--paper-red').trim(),
      navy: style.getPropertyValue('--paper-navy').trim(),
    }
  })
  expect(paperPalette).toEqual({
    sky: '#36b7db',
    grass: '#3f9b55',
    red: '#ef493d',
    navy: '#082d57',
  })
  await expect(house).toHaveAttribute('src', /red-house-hero-v2\.png/)
  await expect(page.locator('.home')).toHaveCSS('background-color', 'rgb(54, 183, 219)')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'docs/design/qa/07-live-home-interior.png' })
  await expect(page.locator('.home')).toHaveAttribute('data-intro', 'complete', { timeout: 12_000 })
  await expect(page.getByRole('heading', { name: 'Red House' })).toHaveCSS('opacity', '1')
  const titleStyle = await page.getByRole('heading', { name: 'Red House' }).evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      fontFamily: style.fontFamily,
      textShadow: style.textShadow,
      textStrokeWidth: style.getPropertyValue('-webkit-text-stroke-width'),
    }
  })
  expect(titleStyle.fontFamily).toContain('Arial')
  expect(titleStyle.textShadow).toBe('none')
  expect(titleStyle.textStrokeWidth).toBe('0px')
  const tagline = page.getByText('关注视力好帮手！')
  await expect(tagline).toBeVisible()
  await expect(tagline).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(tagline).toHaveCSS('font-weight', '800')
  const taglineFont = await tagline.evaluate((element) => getComputedStyle(element).fontFamily)
  expect(taglineFont).toContain('Arial')
  const [houseBox, viewport] = await Promise.all([house.boundingBox(), page.viewportSize()])
  expect(houseBox?.width).toBeLessThanOrEqual((viewport?.width ?? 0) * 0.4)
  await expect(page.getByText(/两米 · 双眼分测/)).toHaveCount(0)
  await expect(page.getByText(/Windows 10\/11/)).toHaveCount(0)
  await expect(page.getByText(/不能替代专业眼科检查/)).toBeVisible()
  await expect(page.locator('#main-content')).toHaveCSS('filter', 'none')
  await page.mouse.move(80, 120)
  const parallax = await page.locator('.home').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      far: style.getPropertyValue('--far-x'),
      near: style.getPropertyValue('--near-x'),
    }
  })
  expect(parallax.far).not.toBe('0px')
  expect(parallax.near).not.toBe(parallax.far)
  const settledHouseBox = await house.boundingBox()
  await page.mouse.move(1_180, 640)
  await page.waitForTimeout(1_000)
  const movedHouseBox = await house.boundingBox()
  expect(movedHouseBox?.x).toBeCloseTo(settledHouseBox?.x ?? 0, 1)
  expect(movedHouseBox?.y).toBeCloseTo(settledHouseBox?.y ?? 0, 1)
  await expect(house).toHaveCSS('opacity', '1')
  await page.screenshot({ path: 'docs/design/qa/08-live-home.png' })
})

test('speaks the two-metre instruction and accepts OK before starting', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = []
    class MockUtterance {
      text: string
      lang = ''
      rate = 1
      pitch = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) { this.text = text }
    }
    class MockSpeechRecognition {
      continuous = false
      interimResults = false
      lang = ''
      maxAlternatives = 0
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      onnomatch: (() => void) | null = null
      onresult: ((event: unknown) => void) | null = null
      onstart: (() => void) | null = null
      start() {
        Object.assign(window, { __redHouseRecognition: this })
        queueMicrotask(() => this.onstart?.())
      }
      abort() {}
      emit(transcript: string) {
        this.onresult?.({
          resultIndex: 0,
          results: Object.assign([{ isFinal: true, 0: { transcript } }], { length: 1 }),
        })
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: MockUtterance,
    })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: MockUtterance) {
          spoken.push(utterance.text)
          const recognition = (window as unknown as {
            __redHouseRecognition?: { emit: (text: string) => void }
          }).__redHouseRecognition
          recognition?.emit('准备好')
          queueMicrotask(() => utterance.onend?.())
        },
      },
    })
    Object.assign(window, {
      webkitSpeechRecognition: MockSpeechRecognition,
      SpeechRecognition: MockSpeechRecognition,
      __redHouseSpoken: spoken,
    })
  })

  const app = new VisionPage(page)
  await app.goto('/?test=1')
  await app.enterScreening()

  await expect.poll(() => page.evaluate(() => (window as unknown as { __redHouseSpoken: string[] }).__redHouseSpoken)).toContain(
    '请站到两米外。准备好后，请作答。',
  )
  await page.waitForTimeout(150)
  await expect(page.getByRole('heading', { name: '站到 2 米' })).toBeVisible()
  await page.evaluate(() => {
    const recognition = (window as unknown as { __redHouseRecognition: { emit: (text: string) => void } }).__redHouseRecognition
    recognition.emit('OK')
  })
  await expect(page.getByRole('heading', { name: '测试右眼' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __redHouseSpoken: string[] }).__redHouseSpoken)).toContain(
    '请遮住左眼，接下来测试右眼。准备好后，请作答。',
  )
  await page.waitForTimeout(150)
  await expect(page.getByRole('heading', { name: '测试右眼' })).toBeVisible()
  await page.evaluate(() => {
    const recognition = (window as unknown as { __redHouseRecognition: { emit: (text: string) => void } }).__redHouseRecognition
    recognition.emit('OK')
  })
  const optotype = page.locator('.optotype')
  await expect(optotype).toBeVisible()
  await expect(optotype).toHaveCSS('opacity', '1')
  const direction = await optotype.getAttribute('data-direction')
  const spokenDirection: Record<string, string> = {
    up: '上',
    right: '右',
    down: '下',
    left: '左',
  }
  await page.evaluate((spoken) => {
    const recognition = (window as unknown as {
      __redHouseRecognition: { emit: (text: string) => void }
    }).__redHouseRecognition
    recognition.emit(spoken)
  }, spokenDirection[direction ?? ''])
  await expect(optotype).toHaveAttribute('data-level', '4.7')
})

test('accepts OK even when speech synthesis never fires onend', async ({ page }) => {
  await page.addInitScript(() => {
    class MockUtterance {
      text: string
      lang = ''
      rate = 1
      pitch = 1
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) { this.text = text }
    }
    class MockSpeechRecognition {
      continuous = false
      interimResults = false
      lang = ''
      maxAlternatives = 0
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      onnomatch: (() => void) | null = null
      onresult: ((event: unknown) => void) | null = null
      onstart: (() => void) | null = null
      start() {
        Object.assign(window, { __redHouseRecognition: this })
        queueMicrotask(() => this.onstart?.())
      }
      abort() {}
      emit(transcript: string) {
        this.onresult?.({
          resultIndex: 0,
          results: Object.assign([{ isFinal: true, 0: { transcript } }], { length: 1 }),
        })
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak() {} },
    })
    Object.assign(window, {
      webkitSpeechRecognition: MockSpeechRecognition,
      SpeechRecognition: MockSpeechRecognition,
    })
  })

  const app = new VisionPage(page)
  await app.goto('/?test=1&voice=web-speech')
  await app.enterScreening()
  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-state', 'listening')
  await page.evaluate(() => {
    const recognition = (window as unknown as { __redHouseRecognition: { emit: (text: string) => void } }).__redHouseRecognition
    recognition.emit('OK')
  })
  await expect(page.getByRole('heading', { name: '测试右眼' })).toBeVisible()
})

test('shows only the distance instruction and a uniform moving scale', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()

  await expect(page.getByText('先测试右眼')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '站到 2 米' })).toBeVisible()
  await expect(page.locator('.setup-measure-track')).toBeVisible()
  await expect(page.getByRole('button')).toHaveCount(0)
  await page.screenshot({ path: 'docs/design/qa/10-live-setup.png' })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: '测试右眼' })).toBeVisible()
  await expect(page.locator('#main-content')).toHaveCSS('filter', 'blur(0px)')
  await expect(page.locator('#main-content')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await expectCenteredEyeGuide(page, '遮住左眼', '测试右眼')
  await page.screenshot({ path: 'docs/design/qa/11-live-right-eye.png' })
})

test('keeps settings and profile sparse on the white home theme', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await expect(page.locator('.home')).toHaveAttribute('data-intro', 'complete', { timeout: 12_000 })

  await page.getByRole('button', { name: '打开设置' }).click()
  await expect(page.getByRole('heading', { name: '显示' })).toBeVisible()
  await expect(page.locator('.modal-backdrop')).toHaveCSS('opacity', '1')
  await expect(page.locator('.settings-card')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.getByText('测试显示设置')).toHaveCount(0)
  await page.screenshot({ path: 'docs/design/qa/13-live-settings.png' })
  await page.getByRole('button', { name: '关闭设置' }).click()

  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '档案' })).toBeVisible()
  await expect(page.locator('.drawer-backdrop')).toHaveCSS('opacity', '1')
  await expect(page.locator('.profile-drawer')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.getByText(/本次 MVE/)).toHaveCount(0)
  await page.screenshot({ path: 'docs/design/qa/14-live-profile.png' })
})

test('opens the bundled offline microphone from the local Vite app', async ({ page }) => {
  test.setTimeout(90_000)
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      externalRequests.push(request.url())
    }
  })
  const app = new VisionPage(page)
  await app.goto('/?test=1&voice=vosk')
  await app.enterScreening()

  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-state', /loading|listening/)
  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-engine', 'vosk', {
    timeout: 70_000,
  })
  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-state', 'listening')
  expect(externalRequests).toEqual([])
})

test('automatically switches a silent local confirmation to the online fallback', async ({ page }) => {
  test.setTimeout(90_000)
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false
      interimResults = false
      lang = ''
      maxAlternatives = 0
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      onnomatch: (() => void) | null = null
      onresult: ((event: unknown) => void) | null = null
      onstart: (() => void) | null = null
      start() {
        Object.assign(window, { __redHouseFallbackRecognition: this })
        queueMicrotask(() => this.onstart?.())
      }
      abort() {}
      emit(transcript: string) {
        this.onresult?.({
          resultIndex: 0,
          results: Object.assign([{ isFinal: true, 0: { transcript } }], { length: 1 }),
        })
      }
    }
    Object.assign(window, {
      webkitSpeechRecognition: MockSpeechRecognition,
      SpeechRecognition: MockSpeechRecognition,
    })
  })

  const app = new VisionPage(page)
  await app.goto('/?test=1&voice=vosk')
  await app.enterScreening()
  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-engine', 'vosk', {
    timeout: 70_000,
  })
  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-engine', 'web-speech', {
    timeout: 9_000,
  })
  await page.evaluate(() => {
    const recognition = (window as unknown as {
      __redHouseFallbackRecognition: { emit: (text: string) => void }
    }).__redHouseFallbackRecognition
    recognition.emit('OK')
  })
  await expect(page.getByRole('heading', { name: '测试右眼' })).toBeVisible()
})

test('renders a fresh physically matched English word beneath each optotype', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()

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

test('judges each direction before playing distinct pass and error cues', async ({ page }) => {
  await page.addInitScript(() => {
    const frequencies: number[] = []
    class MockAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() { return Promise.resolve() }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        }
      }
      createOscillator() {
        const oscillator = {
          type: 'sine',
          frequency: {
            setValueAtTime(value: number) { frequencies.push(value) },
          },
          connect() {},
          start() {},
          stop() { queueMicrotask(() => oscillator.onended?.()) },
          onended: null as null | (() => void),
        }
        return oscillator
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })
    Object.assign(window, { __redHouseFeedbackFrequencies: frequencies })
  })

  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()
  await app.startEye()

  await app.answerCurrentDirection()
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __redHouseFeedbackFrequencies: number[] }
  ).__redHouseFeedbackFrequencies.slice())).toEqual([659.25, 880])

  const nextMark = page.locator('.optotype')
  await expect(nextMark).toHaveCSS('opacity', '1')
  const shown = await nextMark.getAttribute('data-direction')
  const wrongKey = shown === 'up' ? 'ArrowDown' : 'ArrowUp'
  await page.keyboard.press(wrongKey)
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __redHouseFeedbackFrequencies: number[] }
  ).__redHouseFeedbackFrequencies.slice())).toEqual([659.25, 880, 246.94, 164.81])
})

test('disables and persists answer feedback sounds from the home settings', async ({ page }) => {
  await page.addInitScript(() => {
    const frequencies: number[] = []
    class MockAudioContext {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() { return Promise.resolve() }
      createGain() {
        return {
          gain: {
            setValueAtTime() {},
            exponentialRampToValueAtTime() {},
          },
          connect() {},
          disconnect() {},
        }
      }
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime(value: number) { frequencies.push(value) },
          },
          connect() {},
          start() {},
          stop() {},
          onended: null,
        }
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    })
    Object.assign(window, { __redHouseFeedbackFrequencies: frequencies })
  })

  const app = new VisionPage(page)
  await app.goto()
  await page.getByRole('button', { name: '打开设置' }).click()
  const toggle = page.getByRole('switch', { name: '播放答题音效' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: '关闭设置' }).click()

  await app.enterScreening()
  await app.startEye()
  await app.answerCurrentDirection()
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __redHouseFeedbackFrequencies: number[] }
  ).__redHouseFeedbackFrequencies.slice())).toEqual([])

  await page.reload()
  await page.getByRole('button', { name: '打开设置' }).click()
  await expect(page.getByRole('switch', { name: '播放答题音效' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
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
  await app.goto('/?test=1&voice=web-speech')
  await app.enterScreening()

  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-engine', 'web-speech')
  await expect(page.locator('.setup-voice-orb')).toHaveAttribute('data-state', 'listening')
})

test('completes right and left eye screening and stores a report', async ({ page }) => {
  const app = new VisionPage(page)
  await app.goto()
  await app.enterScreening()
  await app.startEye()
  await app.finishEyeWithCorrectAnswers()

  await expect(page.getByRole('heading', { name: '测试左眼' })).toBeVisible()
  await expect(page.locator('#main-content')).toHaveCSS('filter', 'blur(0px)')
  await expect(page.locator('#main-content')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await expectCenteredEyeGuide(page, '遮住右眼', '测试左眼')
  await page.screenshot({ path: 'docs/design/qa/12-live-left-eye.png' })
  await app.startEye()
  await app.finishEyeWithCorrectAnswers()

  await expect(page.locator('.analysis-progress__ring')).toBeVisible()
  await expect(page.getByAltText('红房子')).toBeVisible()
  await expect(page.locator('.analysis-page')).toHaveCSS('background-color', 'rgb(247, 241, 230)')
  await expect(page.locator('#main-content')).toHaveCSS('opacity', '1')
  await page.screenshot({ path: 'docs/design/qa/15-live-analysis.png' })
  await expect(page.getByRole('heading', { name: '本次结果' })).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toHaveCount(0)
  await expect(page.getByText('Red house')).toBeVisible()
  await expect(page.getByText('红房子')).toHaveCount(0)
  await expect(page.getByText('RED HOUSE VISION')).toHaveCount(0)
  const reportBrandMark = page.locator('.app-header .brand__mark')
  await expect(reportBrandMark).toHaveAttribute('src', '/assets/red-house-cutout-v3.png')
  await expect(reportBrandMark).toHaveCSS('width', '34px')
  await expect(reportBrandMark).toHaveCSS('height', '34px')
  await expect(page.locator('.app--report')).toHaveCSS('background-color', 'rgb(247, 241, 230)')
  await expect(page.locator('.score-pair strong')).toHaveText(['5.2', '5.2'])
  await expect(page.locator('#main-content')).toHaveCSS('filter', 'blur(0px)')
  await page.screenshot({
    path: 'docs/design/qa/09-live-report.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: /详情/ }).click()
  await expect(page.getByRole('heading', { name: '视力变化记录' })).toBeVisible()
  await expect(page.getByText('本次记录')).toBeVisible()
})
