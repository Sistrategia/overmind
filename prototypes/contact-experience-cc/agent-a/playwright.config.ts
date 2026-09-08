import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5181',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5181',
    reuseExistingServer: true,
    timeout: 60_000
  }
});
