// Tests of the built app (npm run test:packaged, after npm run dist:dir or dist:win).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/packaged',
  outputDir: 'test-results/packaged',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [['list']],
});
