// The settings window: opening it, its lockdown, saving, validation and live updates.
import { test, expect } from '@playwright/test';
import { launchApp, tempUserData, readConfig } from './helpers.js';

async function openSettings(app) {
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
  ]);
  await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return win;
}

async function launch() {
  const userData = await tempUserData();
  const { app } = await launchApp({ userData });
  const pet = await app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { app, pet, userData };
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
