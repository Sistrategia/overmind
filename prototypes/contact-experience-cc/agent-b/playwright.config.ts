import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5178',
    headless: true,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark', // OS preference is dark on purpose: the prototypes must still start in light mode
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5178',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
