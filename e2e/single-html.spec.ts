import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { VisionPage } from './pages/VisionPage'

const standaloneUrl = `${pathToFileURL(resolve('red-house-vision.html')).href}?test=1`

test('runs the full two-eye flow from one offline HTML file', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) externalRequests.push(request.url())
  })
  await page.route(/^https?:/, (route) => route.abort())

  const app = new VisionPage(page)
  await app.goto(standaloneUrl)

  await expect(page.locator('.home__scene')).toHaveCount(1)
  await expect(
    page.locator('.home__scene').evaluate((element) =>
      getComputedStyle(element).backgroundImage.startsWith('url("data:image/jpeg;base64,'),
    ),
  ).resolves.toBe(true)

  const modelMetadata = await page.locator('#embedded-vosk-model').evaluate((element) => ({
    bytes: Number(element.getAttribute('data-byte-length')),
    payloadLength: element.textContent?.trim().length ?? 0,
    sha256: element.getAttribute('data-sha256'),
  }))
  expect(modelMetadata.bytes).toBe(43_891_956)
  expect(modelMetadata.payloadLength).toBeGreaterThan(58_000_000)
  expect(modelMetadata.sha256).toMatch(/^[a-f0-9]{64}$/)

  await app.enterScreening()
  await app.startEye()
  await app.finishEyeWithCorrectAnswers()
  await expect(page.getByRole('heading', { name: '现在交换遮挡' })).toBeVisible()
  await app.startEye()
  await app.finishEyeWithCorrectAnswers()

  await expect(page.getByRole('heading', { name: /看见变化/ })).toBeVisible()
  await expect(page.locator('.score-pair strong')).toHaveText(['5.2', '5.2'])
  expect(externalRequests).toEqual([])
})

test('uses the browser microphone fallback when opened as a local file', async ({ page }) => {
  const externalRequests: string[] = []
  const consoleErrors: string[] = []
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) externalRequests.push(request.url())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.route(/^https?:/, (route) => route.abort())

  const app = new VisionPage(page)
  await app.goto(standaloneUrl)
  await app.enterScreening()
  await page.getByRole('button', { name: '启用在线语音备用' }).click()

  await expect(page.getByRole('button', { name: '在线语音备用已开启' })).toBeVisible()
  expect(externalRequests).toEqual([])
  expect(consoleErrors.filter((message) => !message.includes('net::ERR_FAILED'))).toEqual([])
})
