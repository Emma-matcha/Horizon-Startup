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
    await expect(this.page.getByRole('heading', { name: 'Red House' })).toBeVisible()
  }

  async enterScreening() {
    await this.page.getByRole('button', { name: '开始' }).click()
    await expect(this.page.getByRole('dialog')).toBeVisible()
    await this.page.getByRole('button', { name: '同意并继续' }).click()
    await expect(this.page.getByRole('heading', { name: '站到 2 米' })).toBeVisible()
  }

  async startEye() {
    if (await this.page.getByRole('heading', { name: '站到 2 米' }).isVisible().catch(() => false)) {
      await this.page.keyboard.press('Enter')
      await expect(this.page.getByRole('heading', { name: '测试右眼' })).toBeVisible()
    }
    await this.page.keyboard.press('Enter')
    await expect(this.page.locator('.optotype')).toBeVisible()
  }

  async finishEyeWithCorrectAnswers() {
    for (let answer = 0; answer < 8; answer += 1) {
      await this.answerCurrentDirection()
      if (answer < 7) {
        const mark = this.page.locator('.optotype')
        await expect(mark).toHaveAttribute('data-level', (4.7 + answer / 10).toFixed(1))
      }
    }
  }

  async answerCurrentDirection() {
    const mark = this.page.locator('.optotype')
    await expect(mark).toHaveCSS('opacity', '1')
    const direction = await mark.getAttribute('data-direction')
    if (!direction || !keyForDirection[direction]) {
      throw new Error(`Unexpected optotype direction: ${direction}`)
    }
    await this.page.keyboard.press(keyForDirection[direction])
  }
}
