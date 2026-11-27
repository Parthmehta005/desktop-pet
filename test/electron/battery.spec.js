// The low-battery panic in the app: battery reports reach the pet (even when reactions
// are paused), a click opens battery settings, a hidden pet comes back once, and the
// threshold set in Settings applies at once.
import { test, expect } from '@playwright/test';
import { launchApp, readConfig } from './helpers.js';

async function launch() {
  const { app, userData } = await launchApp();
  const pet = await app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { app, pet, userData };
}

const report = (app, percent, { charging = false, present = true } = {}) => app.evaluate(
  (_, b) => globalThis.__desktopPet.onBattery({ type: 'battery', ...b }),
  { percent, charging, present },
);
const mood = (pet) => pet.evaluate(() => window.__pet.controller.snapshot().mood);
const visible = (app) => app.evaluate(() => globalThis.__desktopPet.state.petWindow.win.isVisible());
const setHidden = (app, hidden) => app.evaluate((_, h) => globalThis.__desktopPet.actions.setHidden(h), hidden);

test('a low battery report makes the pet panic in the corner; a click opens battery settings', async () => {
  const { app, pet } = await launch();
  try {
    await report(app, 6);
    await expect.poll(() => mood(pet)).toBe('low-battery');
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-state', 'low-battery');
    await expect.poll(() => pet.evaluate(() => {
      const s = window.__pet.controller.snapshot();
      return s.width - s.petSize - s.x;
    }), { timeout: 20_000 }).toBeLessThan(1);
    const box = await pet.locator('.pet-view').boundingBox();
    await pet.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.batterySettingsCalls))
      .toEqual(['ms-settings:batterysaver']);
    expect(await mood(pet)).toBe('low-battery');

    await report(app, 6, { charging: true });
    await expect.poll(() => mood(pet)).not.toBe('low-battery');
  } finally {
    await app.close();
  }
});

test('only the pet window can ask for battery settings', async () => {
  const { app } = await launch();
  try {
    const [win] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
    ]);
    await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    // The settings window has no such bridge function, and a raw message from it is refused.
    expect(await win.evaluate(() => typeof window.petSettings.openBatterySettings)).toBe('undefined');
    await app.evaluate(({ BrowserWindow, ipcMain }) => {
      const settings = BrowserWindow.getAllWindows().find((w) => w.getTitle().includes('settings'));
      ipcMain.emit('pet:open-battery-settings', { sender: settings.webContents });
    });
    expect(await app.evaluate(() => globalThis.__desktopPet.state.batterySettingsCalls)).toEqual([]);
  } finally {
    await app.close();
  }
});

test('a pet hidden with Ctrl+Alt+P comes back once when the panic starts', async () => {
  const { app, pet } = await launch();
  try {
    await setHidden(app, true);
    await expect.poll(() => visible(app)).toBe(false);
    await report(app, 20);
    expect(await visible(app)).toBe(false, 'not low yet');
    await report(app, 9);
    await expect.poll(() => visible(app)).toBe(true);
    await expect.poll(() => mood(pet)).toBe('low-battery');

    // Hidden again during the same panic: it stays hidden.
    await setHidden(app, true);
    await report(app, 8);
    await report(app, 7);
    expect(await visible(app)).toBe(false);

    // Plugged in, then low again: a new panic, so it comes back again.
    await report(app, 7, { charging: true });
    expect(await visible(app)).toBe(false);
    await report(app, 7);
    await expect.poll(() => visible(app)).toBe(true);
  } finally {
    await app.close();
  }
});

test('battery reports get through "Pause reactions"', async () => {
  const { app, pet } = await launch();
  try {
    await app.evaluate(() => globalThis.__desktopPet.actions.setPaused(true));
    await app.evaluate(() => globalThis.__desktopPet.state.bus.emit({ type: 'commit' }, { source: 'git' }));
    await report(app, 5);
    await expect.poll(() => mood(pet)).toBe('low-battery');
    expect(await pet.evaluate(() => window.__pet.controller.snapshot().history)).not.toContain('celebrating');
  } finally {
    await app.close();
  }
});

test('the threshold set in Settings applies at once, and 0 turns the panic off', async () => {
  const { app, pet, userData } = await launch();
  try {
    await report(app, 25);
    await expect.poll(() => mood(pet)).not.toBe('low-battery');
    const [win] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
    ]);
    await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    const field = win.getByLabel('Panic about the battery at');
    await expect(field).toHaveValue('10');
    await field.fill('30');
    await field.press('Tab');
    await expect.poll(() => mood(pet)).toBe('low-battery');
    await expect.poll(async () => (await readConfig(userData)).lowBatteryPercent).toBe(30);
    await field.fill('0');
    await field.press('Tab');
    await expect.poll(() => mood(pet)).not.toBe('low-battery');
    await field.fill('60');
    await field.press('Tab');
    await expect(win.locator('[data-field="lowBatteryPercent"] .field-error')).toContainText('between 0 and 50');
  } finally {
    await app.close();
  }
});
