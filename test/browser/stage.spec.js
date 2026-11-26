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

async function petCenter(page) {
  const box = await page.locator('.pet-actor .pet-view').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
}

test('clicking the pet pets it', async ({ page }) => {
  await openStage(page);
  const c = await petCenter(page);
  await page.mouse.click(c.x, c.y);
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'petted');
});

test('dragging holds the pet under the pointer; letting go drops it to the ground', async ({ page }) => {
  await openStage(page);
  const strip = await page.locator('#strip').boundingBox();
  const c = await petCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  const target = { x: strip.x + strip.width / 2, y: strip.y + 70 };
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'held');
  const held = await snapshot(page);
  expect(held.dragging).toBe(true);
  expect(held.lift).toBeGreaterThan(40);
  const after = await petCenter(page);
  expect(Math.abs(after.x - target.x), 'the pet follows the pointer').toBeLessThan(8);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).falling).toBe(false);
  const landed = await snapshot(page);
  expect(landed.lift).toBe(0);
  expect(landed.mood).not.toBe('held');
  expect(landed.mood).not.toBe('falling');
});

test('the pet cannot be dragged or dropped outside the stage', async ({ page }) => {
  await openStage(page);
  const strip = await page.locator('#strip').boundingBox();
  const c = await petCenter(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(strip.x + strip.width + 400, strip.y - 300, { steps: 10 });
  const s = await snapshot(page);
  expect(s.x).toBeCloseTo(s.width - s.petSize, 0);
  expect(s.lift).toBeLessThanOrEqual(strip.height - s.petSize + 0.5);
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).lift).toBe(0);
  const end = await snapshot(page);
  expect(end.x).toBeLessThanOrEqual(end.width - end.petSize);
});

test('hovering over the pet is reported, and moving away clears it', async ({ page }) => {
  await openStage(page);
  const strip = await page.locator('#strip').boundingBox();
  const c = await petCenter(page);
  await page.mouse.move(c.x, c.y);
  await expect.poll(async () => (await snapshot(page)).hovering).toBe(true);
  await page.mouse.move(strip.x + 2, strip.y + 2);
  // The pet may have walked under that corner; move somewhere it can't be.
  await page.mouse.move(10, 10);
  await expect.poll(async () => (await snapshot(page)).hovering).toBe(false);
});
