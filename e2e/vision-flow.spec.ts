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
  await page.screenshot({ path: 'docs/design/qa/08-live-home.png' })
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
