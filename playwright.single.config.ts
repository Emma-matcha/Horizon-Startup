import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'single-html.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    },
  },
})
