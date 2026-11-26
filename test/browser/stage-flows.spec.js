// The preview stage end to end: every button, the key event sequences, the fast clock,
// walking bounds at different widths, pet swapping and the wallpaper.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { watchForErrors, openStage, snapshot } from './helpers.js';

const press = (page, action) => page.locator(`[data-action="${action}"]`).click();
const mood = async (page) => (await snapshot(page)).mood;

async function settle(page) {
  // At 10x the opening "Hi!" (3s) is over in a moment.
  await expect.poll(() => mood(page)).toBe('wander');
}

const SINGLE_BUTTONS = [
  // [action, expected mood, expected animation (if different)]
  ['claude-start', 'working'],
  ['claude-stop', 'happy'],
  ['claude-permission', 'alert'],
  ['commit', 'celebrating'],
  ['file-edit', 'focused'],
  ['user-lock', 'sleeping'],
  ['app-start', 'greeting'],
  ['app-music', 'vibing'],
  ['app-game', 'gaming'],
  ['app-video', 'watching'],
  ['app-meeting', 'wander', 'meeting'],
  ['pet', 'petted'],
];

for (const [action, expected, animation = expected] of SINGLE_BUTTONS) {
  test(`button ${action} -> ${animation}`, async ({ page }) => {
    const errors = watchForErrors(page);
    await openStage(page, '?time=12:00&speed=10');
    await settle(page);
    await press(page, action);
    const s = await snapshot(page);
    expect(s.mood).toBe(expected);
    expect(s.state).toBe(animation);
    await expect(page.locator('.pet-view')).toHaveAttribute('data-state', animation);
    expect(errors).toEqual([]);
  });
}

test('buttons that depend on earlier ones', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=10');
  await settle(page);

  await press(page, 'claude-start');
  await press(page, 'claude-another');
  expect((await snapshot(page)).intensity).toBe(2);
  await press(page, 'claude-permission');
  expect(await mood(page)).toBe('alert');
  await press(page, 'claude-tool');
  expect(await mood(page)).toBe('working');
  await press(page, 'claude-stop-all');
  expect(await mood(page)).toBe('happy');
  expect((await snapshot(page)).claude.working).toBe(0);

  await press(page, 'claude-start');
  await press(page, 'claude-end');
  expect((await snapshot(page)).claude.working).toBe(0);

  await press(page, 'app-fullscreen');
  expect((await snapshot(page)).modifiers.hidden).toBe(true);
  await press(page, 'app-editor');
  expect((await snapshot(page)).modifiers.hidden).toBe(false);

  await press(page, 'user-lock');
  await press(page, 'user-unlock');
  expect(await mood(page)).toBe('greeting');
});

test('sequence: start, permission, tool, stop -> working, alert, working, happy, wander', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=10');
  await settle(page);
  const seen = [];
  for (const action of ['claude-start', 'claude-permission', 'claude-tool', 'claude-stop']) {
    await press(page, action);
    seen.push(await mood(page));
  }
  expect(seen).toEqual(['working', 'alert', 'working', 'happy']);
  await expect.poll(() => mood(page), { timeout: 5000 }).toBe('wander');
});

test('sequence: start, go idle, Claude finishes, come back -> working, away-done, happy', async ({ page }) => {
  // One minute per second: 5 idle minutes pass in 5s, well before the session would go
  // stale (10 quiet minutes).
  await openStage(page, '?time=12:00&speed=60');
  await settle(page);
  await press(page, 'claude-start');
  expect(await mood(page)).toBe('working');
  await press(page, 'user-idle');
  await page.waitForTimeout(5500);
  expect(await mood(page), 'sweating outranks sleeping').toBe('working');
  await press(page, 'claude-stop');
  await expect.poll(() => mood(page)).toBe('away-done');
  await press(page, 'user-back');
  expect(await mood(page)).toBe('happy');
});

test('the fast clock reaches sleeping and the stretch reminder in seconds', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=3600');
  await settle(page);
  // 90 active minutes at 1 hour per second. The 12-second reminder flashes by at this
  // speed, so check the mood history rather than the current mood.
  await expect.poll(async () => (await snapshot(page)).history, { timeout: 5000 }).toContain('stretch');
  await press(page, 'user-idle');
  await expect.poll(() => mood(page), { timeout: 3000 }).toBe('sleeping');
});

test('the night clock brings out the nightcap', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=10');
  await settle(page);
  await page.getByLabel('Clock', { exact: true }).selectOption('night');
  await expect.poll(() => mood(page)).toBe('bedtime');
  await expect(page.locator('[data-field="clock"]')).toContainText('00:4');
});

for (const width of [320, 1280, 3840]) {
  test(`the pet stays on the stage at ${width}px wide, even while resizing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openStage(page, '?time=12:00&speed=10');
    const check = async () => {
      for (let i = 0; i < 15; i++) {
        const s = await snapshot(page);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(s.width - s.petSize + 0.001);
        await page.waitForTimeout(80);
      }
    };
    await check();
    await page.setViewportSize({ width: Math.max(320, Math.round(width / 2)), height: 900 });
    await check();
    await page.setViewportSize({ width, height: 900 });
    await check();
  });
}

test('switching pets keeps what the pet is doing', async ({ page }) => {
  await openStage(page, '?time=12:00&speed=10');
  await settle(page);
  await press(page, 'claude-start');
  await page.getByLabel('Pet', { exact: true }).selectOption('penguin');
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'penguin');
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
  expect((await snapshot(page)).claude.working).toBe(1);
});

test('light and dark wallpapers (screenshots for review)', async ({ page }) => {
  await mkdir('test-results/screenshots', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await openStage(page, '?time=12:00&speed=10');
  await press(page, 'claude-start');
  await press(page, 'claude-another');
  await expect(page.locator('.desktop')).toHaveAttribute('data-wallpaper', 'light');
  await page.locator('.desktop').screenshot({ path: 'test-results/screenshots/stage-light.png' });
  await page.getByLabel('Wallpaper', { exact: true }).selectOption('dark');
  await expect(page.locator('.desktop')).toHaveAttribute('data-wallpaper', 'dark');
  await page.locator('.desktop').screenshot({ path: 'test-results/screenshots/stage-dark.png' });
});
