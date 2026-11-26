// A run of the whole app for the review log: what it costs to keep the pet on screen,
// and a screenshot of the real window.
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchApp } from './helpers.js';

test('resource use while the pet wanders (recorded for the review log)', async () => {
  const { app } = await launchApp();
  try {
    const page = await app.firstWindow();
    await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    await page.waitForTimeout(3000); // let start-up settle
    // CPU is averaged over the time between two getAppMetrics() calls.
    await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics());
    await page.waitForTimeout(5000);
    const metrics = await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics().map((m) => ({
      type: m.type,
      cpuPercent: Math.round(m.cpu.percentCPUUsage * 10) / 10,
      memoryMB: Math.round(m.memory.workingSetSize / 1024),
    })));
    const total = {
      cpuPercent: Math.round(metrics.reduce((s, m) => s + m.cpuPercent, 0) * 10) / 10,
      memoryMB: metrics.reduce((s, m) => s + m.memoryMB, 0),
    };
    await mkdir('test-results', { recursive: true });
    await writeFile('test-results/electron-metrics.json', `${JSON.stringify({ total, processes: metrics }, null, 2)}\n`);
    console.log(`Desktop Pet resource use: ${total.cpuPercent}% CPU, ${total.memoryMB} MB across ${metrics.length} processes`);
    expect(metrics.length).toBeGreaterThan(0);
    await mkdir('test-results/screenshots', { recursive: true });
    await page.screenshot({ path: 'test-results/screenshots/electron-window.png' });
  } finally {
    await app.close();
  }
});
