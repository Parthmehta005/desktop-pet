// Browser tests for the preview page (npm run test:browser).
// Electron tests have their own config (added in M5).
import { defineConfig, devices } from '@playwright/test';

// PREVIEW_PORT lets two test runs share a machine without testing each other's files.
const PORT = Number(process.env.PREVIEW_PORT) || 4173;

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
    // Never reuse a server already on the port: it could be serving another checkout.
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
