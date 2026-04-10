import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chrome-system',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        ...(process.env.E2E_CHROME_PATH ? { executablePath: process.env.E2E_CHROME_PATH } : {}),
      },
    },
  ],
})
