import { test, expect } from '@playwright/test';
import { watchForErrors } from './helpers.js';

export async function openStage(page, query = '') {
  await page.goto(`/preview/stage.html${query}`);
  await page.locator('#stage[data-ready="true"]').waitFor({ state: 'attached' });
}

export const snapshot = (page) => page.evaluate(() => window.__stage.controller.snapshot());

test('the stage loads cleanly and the pet greets, then walks', async ({ page }) => {
  const errors = watchForErrors(page);
  await openStage(page);
  expect((await snapshot(page)).mood).toBe('greeting');
  await expect.poll(async () => (await snapshot(page)).mood, { timeout: 6000 }).toBe('wander');
  const xs = [];
  for (let i = 0; i < 12; i++) {
    xs.push((await snapshot(page)).x);
    await page.waitForTimeout(250);
  }
  expect(new Set(xs.map(Math.round)).size, 'the pet moved').toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('the pet view follows the engine', async ({ page }) => {
  await openStage(page);
  await page.evaluate(() => window.__stage.controller.dispatch({ type: 'claude', hook: 'UserPromptSubmit', sessionId: 'a' }));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
  await page.evaluate(() => window.__stage.controller.dispatch({ type: 'claude', hook: 'UserPromptSubmit', sessionId: 'b' }));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-intensity', '2');
});
