// The hide-or-show keyboard shortcut: registered at start, changed or turned off from
// Settings, unsafe ones refused, and one another app owns reported.
import { test, expect } from '@playwright/test';
import { launchApp, readConfig, tempUserData, writeConfig, freePort } from './helpers.js';

async function setup(options) {
  const { app, userData } = await launchApp(options);
  const pet = await app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
  ]);
  await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { app, win, userData };
}

const registered = (app, shortcut) => app.evaluate(({ globalShortcut }, s) => globalShortcut.isRegistered(s), shortcut);
const trayHint = (app) => app.evaluate(() => globalThis.__desktopPet.trayMenu()[1].accelerator ?? null);

test('Ctrl+Alt+P is registered at start, and shown in Settings and the tray', async () => {
  const { app, win } = await setup();
  try {
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(true);
    await expect(win.getByLabel('Hide or show the pet')).toHaveValue('Ctrl+Alt+P');
    expect(await trayHint(app)).toBe('Ctrl+Alt+P');
    await expect(win.locator('.shortcut-problem')).toBeHidden();
  } finally {
    await app.close();
  }
});

test('pressing new keys in Settings changes the shortcut and frees the old one', async () => {
  const { app, win, userData } = await setup();
  try {
    const box = win.getByLabel('Hide or show the pet');
    await box.click();
    await win.keyboard.press('Control+Alt+KeyK');
    await expect(box).toHaveValue('Ctrl+Alt+K');
    await expect.poll(async () => (await readConfig(userData)).toggleShortcut).toBe('Ctrl+Alt+K');
    expect(await registered(app, 'Ctrl+Alt+K')).toBe(true);
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(false);
    expect(await trayHint(app)).toBe('Ctrl+Alt+K');

    // Holding modifiers alone changes nothing yet.
    await win.keyboard.down('Control');
    await win.keyboard.down('Alt');
    await win.keyboard.up('Alt');
    await win.keyboard.up('Control');
    await expect(box).toHaveValue('Ctrl+Alt+K');
  } finally {
    await app.close();
  }
});

test('a shortcut that would get in the way of typing is refused and not saved', async () => {
  const { app, win, userData } = await setup();
  try {
    const box = win.getByLabel('Hide or show the pet');
    await box.click();
    await win.keyboard.press('Shift+KeyP');
    await expect(win.locator('[data-field="toggleShortcut"] .field-error')).toContainText('needs Ctrl, Alt or the Windows key');
    await win.keyboard.press('KeyP');
    await expect(win.locator('[data-field="toggleShortcut"] .field-error')).toContainText('needs Ctrl, Alt or the Windows key');
    await expect(box).toHaveValue('Ctrl+Alt+P');
    expect((await readConfig(userData)).toggleShortcut).toBe('Ctrl+Alt+P');
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(true);
    // A good one afterwards clears the message.
    await win.keyboard.press('Control+Alt+KeyH');
    await expect(box).toHaveValue('Ctrl+Alt+H');
    await expect(win.locator('[data-field="toggleShortcut"] .field-error')).toBeHidden();
  } finally {
    await app.close();
  }
});

test('the shortcut can be turned off, with the button or Backspace, and set again', async () => {
  const { app, win, userData } = await setup();
  try {
    const box = win.getByLabel('Hide or show the pet');
    await win.getByRole('button', { name: 'Turn off' }).click();
    await expect(box).toHaveValue('');
    await expect.poll(async () => (await readConfig(userData)).toggleShortcut).toBe(null);
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(false);
    expect(await trayHint(app)).toBe(null);
    await expect(win.getByRole('button', { name: 'Turn off' })).toBeDisabled();

    await box.click();
    await win.keyboard.press('Control+Alt+KeyP');
    await expect(box).toHaveValue('Ctrl+Alt+P');
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(true);
    await win.keyboard.press('Backspace');
    await expect(box).toHaveValue('');
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(false);
  } finally {
    await app.close();
  }
});

test('a shortcut another app already owns is reported, and the pet carries on', async () => {
  const { app, win } = await setup();
  try {
    // Stand-in for another app holding Ctrl+Alt+J.
    expect(await app.evaluate(({ globalShortcut }) => globalShortcut.register('Ctrl+Alt+J', () => {}))).toBe(true);
    const box = win.getByLabel('Hide or show the pet');
    await box.click();
    await win.keyboard.press('Control+Alt+KeyJ');
    await expect(box).toHaveValue('Ctrl+Alt+J');
    await expect(win.locator('.shortcut-problem')).toContainText('already used by another app');
    expect(await trayHint(app)).toBe(null);
    // Picking a free one clears the warning.
    await win.keyboard.press('Control+Alt+KeyL');
    await expect(win.locator('.shortcut-problem')).toBeHidden();
    expect(await registered(app, 'Ctrl+Alt+L')).toBe(true);
  } finally {
    await app.close();
  }
});

test('a shortcut set in config.json is used at start; turned off there, nothing is registered', async () => {
  const userData = await tempUserData();
  await writeConfig(userData, { hookPort: await freePort(), toggleShortcut: null });
  const { app, win } = await setup({ userData });
  try {
    await expect(win.getByLabel('Hide or show the pet')).toHaveValue('');
    expect(await registered(app, 'Ctrl+Alt+P')).toBe(false);
    expect(await app.evaluate(() => globalThis.__desktopPet.state.shortcut)).toEqual({ shortcut: null, registered: false, error: null });
  } finally {
    await app.close();
  }
});
