// Browser tests for the preview page (npm run test:browser).
// Electron tests have their own config (added in M5).
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'test/browser',
  outputDir: 'test-results/playwright',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'off',
  },
  webServer: {
    command: `node scripts/preview-server.js --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/preview/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
