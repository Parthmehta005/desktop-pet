// GUIDE.md, followed step by step in the real app (everything but downloading and
// installing it, which CI's Windows job and the release workflow cover).
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, tempUserData, readConfig } from './helpers.js';

const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

const menu = (app) => app.evaluate(() => globalThis.__desktopPet.trayMenu().map((m) => m.label ?? '---'));
const click = (app, label) => app.evaluate((_, l) => globalThis.__desktopPet.trayMenu().find((m) => m.label === l).click(), label);

test('the quick guide works as written, from setup to uninstalling the hooks', async () => {
  const { app, userData, claudeDir } = await launchApp();
  const pet = await app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });

  // Set up, step 2: the pet is there, and so is the tray menu.
  // (The window appears once its page has drawn, a moment after the app has started.)
  await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.petWindow.win.isVisible())).toBe(true);
  expect(await menu(app)).toEqual(expect.arrayContaining(['Install Claude Code hooks', 'Settings...', 'Quit Desktop Pet']));

  // Step 3: Install Claude Code hooks, and the menu says connected.
  await click(app, 'Install Claude Code hooks');
  await expect.poll(() => menu(app)).toContain('Claude Code: connected');
  expect(Object.keys(JSON.parse(await readFile(path.join(claudeDir, 'settings.json'), 'utf8')).hooks)).toContain('Stop');

  // Step 4: Settings... → Watched folders → Add folder..., and Start when I sign in.
  const [win] = await Promise.all([app.waitForEvent('window'), click(app, 'Settings...')]);
  await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  const folder = await tempUserData();
  await app.evaluate((_, f) => { globalThis.__desktopPet.state.testFolderPicks.push(f); }, folder);
  await expect(win.getByRole('group', { name: 'Watched folders' })).toBeVisible();
  await win.getByRole('button', { name: 'Add folder...' }).click();
  await expect.poll(async () => (await readConfig(userData)).watchedFolders).toEqual([folder]);
  await win.getByLabel('Start when I sign in').check();
  await expect.poll(async () => (await readConfig(userData)).launchAtLogin).toBe(true);
  await expect(win.getByLabel('Turn off hardware acceleration')).toBeVisible();
  await win.close();

  // Use it: Hide pet / Show pet (Ctrl+Alt+P is registered for the same thing).
  expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('Ctrl+Alt+P'))).toBe(true);
  await click(app, 'Hide pet');
  await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.petWindow.win.isVisible())).toBe(false);
  await click(app, 'Show pet');
  await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.petWindow.win.isVisible())).toBe(true);

  // See your version: the top line of the tray menu.
  expect((await menu(app))[0]).toBe(`Desktop Pet ${pkg.version}`);

  // Pet, Pause reactions and Test reactions are where the guide says.
  const items = await app.evaluate(() => Object.fromEntries(globalThis.__desktopPet.trayMenu()
    .filter((m) => m.label).map((m) => [m.label, m.submenu ? m.submenu.length : m.type ?? 'item'])));
  expect(items.Pet).toBe(5);
  expect(items['Pause reactions']).toBe('checkbox');
  expect(items['Test reactions']).toBeGreaterThan(5);

  // Uninstall, step 1: Remove Claude Code hooks.
  await click(app, 'Remove Claude Code hooks');
  await expect.poll(() => menu(app)).toContain('Claude Code: hooks not installed');

  // Step 2: Quit Desktop Pet closes the app.
  const closed = app.waitForEvent('close');
  await click(app, 'Quit Desktop Pet');
  await closed;
});
