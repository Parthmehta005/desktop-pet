// The low-battery panic on the preview stage: it runs to the right-hand end of the strip,
// faces right and points, beats a meeting and a fullscreen app, asks for battery settings
// when clicked, and calms down when plugged in.
import { test, expect } from '@playwright/test';
import { watchForErrors, openStage, snapshot } from './helpers.js';

const press = (page, action) => page.locator(`[data-action="${action}"]`).click();
const gapToRightEnd = async (page) => {
  const s = await snapshot(page);
  return s.width - s.petSize - s.x;
};

/** Carries the pet to the left-hand end and lets it land there. */
async function putAtLeftEnd(page) {
  const strip = await page.locator('#strip').boundingBox();
  const box = await page.locator('.pet-actor .pet-view').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(strip.x + 5, strip.y + strip.height - 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).falling).toBe(false);
}

test('low battery: the pet runs to the right-hand end with its legs going, then faces right and panics', async ({ page }) => {
  const errors = watchForErrors(page);
  await openStage(page, '?time=12:00&speed=10');
  await expect.poll(async () => (await snapshot(page)).mood).toBe('wander');
  await putAtLeftEnd(page);
  expect(await gapToRightEnd(page)).toBeGreaterThan(200);

  await press(page, 'battery-low');
  expect((await snapshot(page)).mood).toBe('low-battery');
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'low-battery');
  await expect(page.locator('.pet-bubble')).toHaveText('Low battery!');
  // On the way: running, legs going, facing right.
  await expect(page.locator('.pet-view')).toHaveAttribute('data-moving', 'true');
  await expect(page.locator('.pet-view')).toHaveAttribute('data-facing', '1');
  // There: at the end, facing right, standing still.
  await expect.poll(() => gapToRightEnd(page), { timeout: 15_000 }).toBeLessThan(1);
  const there = await snapshot(page);
  expect(there.facing).toBe(1);
  expect(there.moving).toBe(false);
  await expect(page.locator('.pet-view')).toHaveAttribute('data-moving', 'false');
  await expect(page.locator('[data-field="battery"]')).toHaveText('7%, on battery');
  expect(errors).toEqual([]);
});

test('clicking the panicking pet asks for battery settings instead of petting it', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=10');
  await press(page, 'battery-low');
  await expect.poll(() => gapToRightEnd(page), { timeout: 15_000 }).toBeLessThan(1);
  const box = await page.locator('.pet-actor .pet-view').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await expect(page.locator('[data-field="battery"]')).toHaveText('7%, on battery; battery settings asked for 1x');
  expect((await snapshot(page)).mood).toBe('low-battery');
  expect((await snapshot(page)).history).not.toContain('petted');
});

test('it beats a meeting and a fullscreen app, and plugging in calms it', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=10');
  await press(page, 'app-meeting');
  await press(page, 'battery-low');
  let s = await snapshot(page);
  expect(s.mood).toBe('low-battery');
  expect(s.modifiers).toEqual({ meeting: false, hidden: false });
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'low-battery');
  await expect(page.locator('.pet-bubble')).toHaveText('Low battery!');
  await press(page, 'app-fullscreen');
  s = await snapshot(page);
  expect(s.mood).toBe('low-battery');
  expect(s.modifiers.hidden).toBe(false);
  await press(page, 'battery-plug');
  s = await snapshot(page);
  expect(s.mood).not.toBe('low-battery');
  expect(s.modifiers.hidden).toBe(true);
});
