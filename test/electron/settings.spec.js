// The settings window: opening it, its lockdown, saving, validation and live updates.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, tempUserData, readConfig } from './helpers.js';

async function openSettings(app) {
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
  ]);
  await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return win;
}

async function launch(options = {}) {
  const { app, userData, claudeDir } = await launchApp(options);
  const pet = await app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { app, pet, userData, claudeDir };
}

test('the tray opens one settings window, and opening it again reuses it', async () => {
  const { app } = await launch();
  try {
    const win = await openSettings(app);
    await expect(win).toHaveTitle('Desktop Pet settings');
    await expect(win.getByRole('heading', { name: 'Desktop Pet settings' })).toBeVisible();
    await app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); });
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(2);
  } finally {
    await app.close();
  }
});

test('the settings window is locked down like the pet window', async () => {
  const { app } = await launch();
  try {
    const win = await openSettings(app);
    const prefs = await app.evaluate(() => {
      const p = globalThis.__desktopPet.state.settings.window.webContents.getLastWebPreferences();
      return { contextIsolation: p.contextIsolation, sandbox: p.sandbox, nodeIntegration: p.nodeIntegration };
    });
    expect(prefs).toEqual({ contextIsolation: true, sandbox: true, nodeIntegration: false });
    const page = await win.evaluate(() => ({
      url: location.href,
      csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
      require: typeof window.require,
      bridge: Object.keys(window.petSettings).sort(),
      petBridge: typeof window.desktopPet,
    }));
    expect(page.url).toBe('app://desktop-pet/renderer/settings.html');
    expect(page.csp).toContain("script-src 'self'");
    expect(page.require).toBe('undefined');
    expect(page.bridge).toEqual(['getState', 'installHooks', 'onState', 'pickFolder', 'save', 'uninstallHooks']);
    expect(page.petBridge).toBe('undefined');
  } finally {
    await app.close();
  }
});

test('invalid input shows a message and is never saved; valid input is saved', async () => {
  const { app, userData } = await launch();
  try {
    const win = await openSettings(app);
    const idle = win.getByLabel('Fall asleep after');
    await idle.fill('0');
    await idle.press('Tab');
    await expect(win.locator('[data-field="idleMinutes"] .field-error')).toContainText('between 1 and 240');
    expect((await readConfig(userData)).idleMinutes).toBe(5);

    await idle.fill('12');
    await idle.press('Tab');
    await expect(win.locator('[data-field="idleMinutes"] .field-error')).toBeHidden();
    await expect.poll(async () => (await readConfig(userData)).idleMinutes).toBe(12);

    await win.getByLabel('Quiet during meetings').uncheck();
    await expect.poll(async () => (await readConfig(userData)).quietDuringMeetings).toBe(false);
  } finally {
    await app.close();
  }
});

test('the main process rejects unknown or internal settings from the window', async () => {
  const { app } = await launch();
  try {
    const win = await openSettings(app);
    const results = await win.evaluate(async () => [
      await window.petSettings.save({ hookToken: 'stolen-token-attempt-000000' }),
      await window.petSettings.save({ madeUp: 1 }),
      await window.petSettings.save('nonsense'),
      await window.petSettings.save({}),
    ]);
    for (const r of results) expect(r.ok).toBe(false);
    expect((await win.evaluate(() => window.petSettings.getState())).config.hookToken).toBeUndefined();
  } finally {
    await app.close();
  }
});

test('settings survive a restart and changes from elsewhere show up live', async () => {
  const { app, userData } = await launch();
  let again;
  try {
    const win = await openSettings(app);
    await win.getByLabel('Fall asleep after').fill('17');
    await win.getByLabel('Fall asleep after').press('Tab');
    await expect.poll(async () => (await readConfig(userData)).idleMinutes).toBe(17);
    await app.evaluate(() => globalThis.__desktopPet.setConfig({ hideWhenFullscreen: false }));
    await expect(win.getByLabel('Hide when something is fullscreen')).not.toBeChecked();
  } finally {
    await app.close();
  }
  try {
    again = (await launchApp({ userData })).app;
    await (await again.firstWindow()).locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    const win = await openSettings(again);
    await expect(win.getByLabel('Fall asleep after')).toHaveValue('17');
    await expect(win.getByLabel('Hide when something is fullscreen')).not.toBeChecked();
  } finally {
    await again?.close();
  }
});

test('watched folders: add with the folder picker, remove, and the watcher follows', async () => {
  const { app, userData } = await launch();
  const a = await tempUserData();
  const b = await tempUserData();
  try {
    const win = await openSettings(app);
    await expect(win.locator('[data-field="watchedFolders"] .empty')).toContainText('every Claude session counts');

    await app.evaluate((_, folders) => { globalThis.__desktopPet.state.testFolderPicks.push(...folders); }, [a, b, a]);
    const add = win.getByRole('button', { name: 'Add folder...' });
    // A slow save (as on a busy disk) must not make the second folder replace the first.
    await app.evaluate(() => { globalThis.__desktopPet.state.testSaveDelayMs = 300; });
    await add.click();
    await add.click();
    await expect(win.locator('.folder-list code')).toHaveText([a, b]);
    await app.evaluate(() => { globalThis.__desktopPet.state.testSaveDelayMs = 0; });
    await add.click(); // the same folder again is ignored
    await expect(win.locator('.folder-list code')).toHaveText([a, b]);
    await expect.poll(async () => (await readConfig(userData)).watchedFolders).toEqual([a, b]);
    await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.sources.repo.folders)).toEqual([a, b]);

    await win.getByRole('button', { name: `Stop watching ${a}` }).click();
    await expect(win.locator('.folder-list code')).toHaveText([b]);
    await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.sources.repo.folders)).toEqual([b]);

    await add.click(); // nothing queued: like pressing Cancel in the picker
    await expect(win.locator('.folder-list code')).toHaveText([b]);
  } finally {
    await app.close();
  }
});

test('the pet picker shows every pet alive, and picking one swaps the pet at once', async () => {
  const { app, pet, userData } = await launch();
  try {
    const win = await openSettings(app);
    const cards = win.locator('.pet-card');
    await expect(cards).toHaveCount(6);
    await expect(win.locator('.pet-card .pet-svg')).toHaveCount(6);
    await expect(win.locator('.pet-card.selected')).toHaveAttribute('data-pet', 'cat');
    await win.getByText('Biscuit').click();
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-pet', 'corgi');
    await expect(win.locator('.pet-card.selected')).toHaveAttribute('data-pet', 'corgi');
    await expect.poll(async () => (await readConfig(userData)).pet).toBe('corgi');
  } finally {
    await app.close();
  }
});

test('"a different pet every day" switches pets when the date changes', async () => {
  const { app, pet } = await launch();
  const { petForDay } = await import('../../src/core/pets.js');
  try {
    const win = await openSettings(app);
    await win.getByLabel('A different pet every day').check();
    const today = petForDay(new Date());
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-pet', today);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await app.evaluate((_, ms) => globalThis.__desktopPet.checkShuffle(ms), tomorrow.getTime());
    const next = petForDay(tomorrow);
    expect(next).not.toBe(today);
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-pet', next);
    await expect(win.locator('.pet-card.selected')).toHaveAttribute('data-pet', next);
  } finally {
    await app.close();
  }
});

test('app rules: add, catch a bad pattern, fix it, reorder, delete, restore; the pet obeys at once', async () => {
  const { app, pet, userData } = await launch();
  try {
    const win = await openSettings(app);
    const rows = win.locator('table.rules tbody tr');
    const defaults = await rows.count();
    expect(defaults).toBeGreaterThan(5);

    await win.getByRole('button', { name: 'Add rule' }).click();
    await expect(rows).toHaveCount(defaults + 1);
    const n = defaults + 1;

    // A broken regular expression is caught and not saved.
    const proc = win.getByLabel(`Process, rule ${n}`, { exact: true });
    await proc.fill('(unclosed');
    await proc.press('Tab');
    await expect(win.locator('[data-field="appRules"] .field-error')).toContainText('not a valid regular expression');
    expect((await readConfig(userData)).appRules).toHaveLength(defaults + 1);
    expect((await readConfig(userData)).appRules.at(-1).process).toBe('^app-name$');

    await proc.fill('^figma$');
    await proc.press('Tab');
    await expect(win.locator('[data-field="appRules"] .field-error')).toBeHidden();
    await expect.poll(async () => (await readConfig(userData)).appRules.at(-1).process).toBe('^figma$');

    // The pet uses the new rule straight away.
    await app.evaluate(() => globalThis.__desktopPet.state.bus.emit({ type: 'app', process: 'Figma', title: 'Design' }, { source: 'test' }));
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-state', 'vibing');

    // Move it to the top, then delete it.
    for (let i = n; i > 1; i--) await win.getByRole('button', { name: `Move up rule ${i}`, exact: true }).click();
    await expect.poll(async () => (await readConfig(userData)).appRules[0].process).toBe('^figma$');
    await win.getByRole('button', { name: 'Delete rule 1', exact: true }).click();
    await expect(rows).toHaveCount(defaults);

    await win.getByRole('button', { name: 'Delete rule 1', exact: true }).click();
    await expect(rows).toHaveCount(defaults - 1);
    await win.getByRole('button', { name: 'Restore default rules' }).click();
    await expect(rows).toHaveCount(defaults);

    // Quick clicks each build on the last save instead of a stale copy of the list,
    // even when saving is slow.
    await app.evaluate(() => { globalThis.__desktopPet.state.testSaveDelayMs = 300; });
    await win.getByRole('button', { name: 'Add rule' }).click();
    await win.getByRole('button', { name: 'Add rule' }).click();
    await expect(rows).toHaveCount(defaults + 2);
    await expect.poll(async () => (await readConfig(userData)).appRules.length).toBe(defaults + 2);
  } finally {
    await app.close();
  }
});

test('the hooks panel shows the status and installs or removes the hooks (in a temp Claude folder)', async () => {
  const { app, claudeDir } = await launch();
  try {
    const win = await openSettings(app);
    const status = win.locator('.hooks-status');
    await expect(status).toHaveText('Not installed yet.');
    await expect(win.getByRole('button', { name: 'Remove Claude Code hooks' })).toBeDisabled();

    await win.getByRole('button', { name: 'Install Claude Code hooks' }).click();
    await expect(status).toHaveAttribute('data-status', 'installed');
    await expect(win.locator('.hooks-message')).toContainText(path.join(claudeDir, 'settings.json'));
    const saved = JSON.parse(await readFile(path.join(claudeDir, 'settings.json'), 'utf8'));
    expect(Object.keys(saved.hooks)).toContain('Stop');
    await expect(win.getByRole('button', { name: 'Install Claude Code hooks' })).toBeDisabled();

    await win.getByRole('button', { name: 'Remove Claude Code hooks' }).click();
    await expect(status).toHaveAttribute('data-status', 'not-installed');
  } finally {
    await app.close();
  }
});

test('"Start when I sign in" turns the login item on and off', async () => {
  const { app } = await launch();
  try {
    const calls = () => app.evaluate(() => globalThis.__desktopPet.state.loginItemCalls);
    expect(await calls()).toEqual([{ openAtLogin: false }]);
    const win = await openSettings(app);
    await win.getByLabel('Start when I sign in').check();
    await expect.poll(calls).toEqual([{ openAtLogin: false }, { openAtLogin: true }]);
    await win.getByLabel('Start when I sign in').uncheck();
    await expect.poll(async () => (await calls()).at(-1)).toEqual({ openAtLogin: false });
  } finally {
    await app.close();
  }
});

test('the portable .exe registers itself for sign-in, not its temporary copy', async () => {
  const exe = 'C:\\Users\\me\\Downloads\\DesktopPet-portable.exe';
  const { app } = await launch({ env: { PORTABLE_EXECUTABLE_FILE: exe } });
  try {
    const calls = () => app.evaluate(() => globalThis.__desktopPet.state.loginItemCalls);
    await expect.poll(calls).toEqual([{ openAtLogin: false, path: exe }]);
    const win = await openSettings(app);
    await win.getByLabel('Start when I sign in').check();
    await expect.poll(async () => (await calls()).at(-1)).toEqual({ openAtLogin: true, path: exe });
  } finally {
    await app.close();
  }
});
