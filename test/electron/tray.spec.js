import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp } from './helpers.js';
import { TEST_REACTIONS } from '../../src/main/tray-menu.js';

let app;
let page;
let userData;

test.beforeEach(async () => {
  ({ app, userData } = await launchApp());
  page = await app.firstWindow();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
});
test.afterEach(async () => { await app?.close(); });

const menuLabels = () => app.evaluate(() => globalThis.__desktopPet.trayMenu().map((m) => m.label ?? '---'));
const state = () => page.evaluate(() => window.__pet.controller.snapshot());

test('the tray icon exists with its menu', async () => {
  const tray = await app.evaluate(() => {
    const t = globalThis.__desktopPet.state.tray.tray;
    return { destroyed: t.isDestroyed(), tooltip: 'Desktop Pet' };
  });
  expect(tray.destroyed).toBe(false);
  expect(await menuLabels()).toEqual(['Desktop Pet', '---', 'Pet', 'Pause reactions', 'Test reactions', '---', 'Quit Desktop Pet']);
});

for (const reaction of TEST_REACTIONS.filter((r) => ['claude-working', 'claude-needs-you', 'commit', 'music', 'pet'].includes(r.id))) {
  test(`test reaction "${reaction.label}" reaches the pet`, async () => {
    const before = (await state()).history.length;
    await app.evaluate((_, id) => globalThis.__desktopPet.actions.test(id), reaction.id);
    await expect.poll(async () => (await state()).history.length).toBeGreaterThan(before);
  });
}

test('picking a pet from the tray swaps it and saves the choice', async () => {
  await app.evaluate(() => globalThis.__desktopPet.actions.setPet('axolotl'));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'axolotl');
  const saved = JSON.parse(await readFile(path.join(userData, 'config.json'), 'utf8'));
  expect(saved.pet).toBe('axolotl');
  const checked = await app.evaluate(() => globalThis.__desktopPet.trayMenu()
    .find((m) => m.label === 'Pet').submenu.filter((p) => p.checked).map((p) => p.label));
  expect(checked).toEqual(['Axo (Axolotl)']);
});

test('pausing calms the pet and ignores real events, but test reactions still work', async () => {
  await app.evaluate(() => globalThis.__desktopPet.actions.test('claude-working'));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
  await app.evaluate(() => globalThis.__desktopPet.actions.setPaused(true));
  await expect.poll(async () => (await state()).claude.working).toBe(0);
  await app.evaluate(() => globalThis.__desktopPet.state.bus.emit({ type: 'commit' }, { source: 'git' }));
  await page.waitForTimeout(200);
  expect((await state()).mood).not.toBe('celebrating');
  await app.evaluate(() => globalThis.__desktopPet.actions.test('commit'));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'celebrating');
  await app.evaluate(() => globalThis.__desktopPet.actions.setPaused(false));
  expect(await app.evaluate(() => globalThis.__desktopPet.state.bus.paused)).toBe(false);
});
