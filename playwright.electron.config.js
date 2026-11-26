// Electron app tests (npm run test:electron). Each test launches the real app with its
// own temporary settings folder.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/electron',
  outputDir: 'test-results/electron',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
});
