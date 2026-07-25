import { expect, type Page } from '@playwright/test'

const keyForDirection: Record<string, string> = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
}

export class VisionPage {
  constructor(readonly page: Page) {}

  async goto(url = '/?test=1') {
    await this.page.goto(url)
    await this.page.evaluate(() => localStorage.clear())
    await this.page.reload()
    await expect(this.page.getByRole('heading', { name: /让每一次看清/ })).toBeVisible()
  }

  async enterScreening() {
    await this.page.getByRole('button', { name: '开始筛查' }).click()
    await expect(this.page.getByRole('dialog')).toBeVisible()
    await this.page.getByRole('button', { name: '同意并继续' }).click()
    await expect(this.page.getByRole('heading', { name: '先量好两米' })).toBeVisible()
  }

  async startEye() {
    const start = this.page.getByRole('button', {
      name: /我已站好，开始右眼测试|开始左眼测试/,
    })
    await start.click()
    await expect(this.page.locator('.optotype')).toBeVisible()
  }

  async finishEyeWithCorrectAnswers() {
    for (let answer = 0; answer < 8; answer += 1) {
      const mark = this.page.locator('.optotype')
      await expect(mark).toHaveCSS('opacity', '1')
      const direction = await mark.getAttribute('data-direction')
      if (!direction || !keyForDirection[direction]) {
        throw new Error(`Unexpected optotype direction: ${direction}`)
      }
      await this.page.keyboard.press(keyForDirection[direction])
      if (answer < 7) {
        await expect(mark).toHaveAttribute('data-level', (4.7 + answer / 10).toFixed(1))
      }
    }
  }
}
