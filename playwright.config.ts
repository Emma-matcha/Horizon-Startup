import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'single-html.spec.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    channel: 'chrome'
  },
  webServer: {
    command: `${JSON.stringify(process.execPath)} node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174`,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false
  }
})
