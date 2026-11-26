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

const send = (page, event) => page.evaluate((e) => window.__stage.controller.dispatch(e), event);

test('a mood with a bubble shows it for a few seconds, then hides it', async ({ page }) => {
  await openStage(page);
  await expect(page.locator('.pet-bubble')).toHaveText('Hi!');
  await send(page, { type: 'claude', hook: 'Stop', sessionId: 'a' });
  await expect(page.locator('.pet-bubble')).toHaveText('Done!');
  await expect(page.locator('.pet-bubble')).toBeVisible();
  await expect(page.locator('.pet-bubble')).toBeHidden({ timeout: 6000 });
});

test('meeting mode dims the pet and hides bubbles; leaving restores both', async ({ page }) => {
  await openStage(page);
  await send(page, { type: 'app', process: 'Zoom', title: 'Zoom Meeting' });
  await expect(page.locator('.pet-view')).toHaveAttribute('data-meeting', 'true');
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'meeting');
  await expect.poll(async () => (await snapshot(page)).opacity).toBe('0.5');
  await send(page, { type: 'claude', hook: 'Stop', sessionId: 'a' });
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'happy');
  await expect(page.locator('.pet-bubble')).toBeHidden();
  await send(page, { type: 'app', process: 'Code', title: 'editor' });
  await expect(page.locator('.pet-view')).toHaveAttribute('data-meeting', 'false');
  await expect.poll(async () => (await snapshot(page)).opacity).toBe('1');
});

test('a fullscreen app hides the pet and it comes back afterwards', async ({ page }) => {
  await openStage(page);
  await send(page, { type: 'app', process: 'game', title: 'Game', fullscreen: true });
  await expect(page.locator('.pet-view')).toHaveAttribute('data-hidden', 'true');
  await expect.poll(async () => (await snapshot(page)).opacity).toBe('0');
  await send(page, { type: 'app', process: 'Code', title: 'editor' });
  await expect.poll(async () => (await snapshot(page)).opacity).toBe('1');
});
