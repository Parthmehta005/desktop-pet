// The built app, as electron-builder packs it. Its code runs from an asar archive, which
// the source-tree tests never see: these check that every page, script, icon and the
// PowerShell script made it into the package and are found there.
//
// Build it first: npm run dist:dir (unpacked, any OS) or npm run dist:win (Windows).
// DESKTOP_PET_EXECUTABLE points at another build.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { launchWithHooks, postHook, ROOT } from '../electron/helpers.js';

const BUILT = {
  win32: path.join(ROOT, 'dist', 'win-unpacked', 'Desktop Pet.exe'),
  linux: path.join(ROOT, 'dist', 'linux-unpacked', 'desktop-pet'),
};
const executablePath = process.env.DESKTOP_PET_EXECUTABLE || BUILT[process.platform];

test.beforeAll(() => {
  if (!executablePath || !existsSync(executablePath)) {
    throw new Error(`No built app at ${executablePath}. Run npm run dist:dir first.`);
  }
});

const launch = (env = {}) => launchWithHooks({}, { executablePath, env });

test('the built app runs from its archive, shows the pet and listens for Claude Code', async () => {
  const { app, page, port, token } = await launch();
  try {
    const info = await app.evaluate(({ app: electronApp }) => ({
      packaged: electronApp.isPackaged,
      appPath: electronApp.getAppPath(),
      name: electronApp.getName(),
    }));
    expect(info.packaged).toBe(true);
    expect(path.basename(info.appPath)).toBe('app.asar');
    expect(info.name).toBe('Desktop Pet');
    await expect(page.locator('.pet-view svg')).toBeVisible();

    const hook = (name) => postHook({ port, token }, { session_id: 'packaged', cwd: ROOT, hook_event_name: name });
    expect((await hook('UserPromptSubmit')).status).toBe(204);
    await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
    expect((await hook('Stop')).status).toBe(204);
    await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'happy');
  } finally {
    await app.close();
  }
});

test('the settings window and the icons load from the archive', async () => {
  const { app } = await launch();
  try {
    const [win] = await Promise.all([
      app.waitForEvent('window'),
      app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
    ]);
    const errors = [];
    win.on('pageerror', (e) => errors.push(e.message));
    await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    await expect(win.getByRole('button', { name: 'Add folder...' })).toBeVisible();
    await expect(win.locator('.pet-card')).toHaveCount(6);
    expect(errors).toEqual([]);

    const icons = await app.evaluate(({ app: electronApp, nativeImage }, files) => files.map((f) => {
      const image = nativeImage.createFromPath(`${electronApp.getAppPath()}/assets/${f}`);
      return { file: f, empty: image.isEmpty() };
    }), ['tray.png', 'tray@2x.png', 'icon.png']);
    expect(icons.filter((i) => i.empty)).toEqual([]);
    expect(await app.evaluate(() => globalThis.__desktopPet.state.tray !== null)).toBe(true);
  } finally {
    await app.close();
  }
});

test('the foreground-app monitor: on Windows it reports the foreground window and the battery within 10s; elsewhere it never starts', async () => {
  const { app } = await launch({ DESKTOP_PET_SOURCES: 'apps' });
  try {
    const platform = await app.evaluate(() => process.platform);
    if (platform !== 'win32') {
      expect(await app.evaluate(() => globalThis.__desktopPet.state.sources.apps.running)).toBe(false);
      return;
    }
    // Restart it with the bus wrapped, so its first line can't be missed.
    await app.evaluate(() => {
      const { state } = globalThis.__desktopPet;
      globalThis.__appEvents = [];
      globalThis.__batteryEvents = [];
      const emit = state.bus.emit;
      state.bus.emit = (event, options) => {
        if (options?.source === 'apps') globalThis.__appEvents.push(event);
        if (options?.source === 'battery') globalThis.__batteryEvents.push(event);
        return emit(event, options);
      };
      state.sources.apps.stop();
      state.sources.apps.start();
    });
    expect(await app.evaluate(() => globalThis.__desktopPet.state.sources.apps.running)).toBe(true);
    await expect.poll(() => app.evaluate(() => globalThis.__appEvents.length), { timeout: 10_000 }).toBeGreaterThan(0);
    const [first] = await app.evaluate(() => globalThis.__appEvents);
    expect(first.type).toBe('app');
    expect(typeof first.process).toBe('string');
    expect(typeof first.fullscreen).toBe('boolean');
    // The battery, from GetSystemPowerStatus (a CI runner has none: present is false).
    await expect.poll(() => app.evaluate(() => globalThis.__batteryEvents.length), { timeout: 10_000 }).toBeGreaterThan(0);
    const [battery] = await app.evaluate(() => globalThis.__batteryEvents);
    console.log(`Battery reported by the built app: ${JSON.stringify(battery)}`);
    expect(battery.type).toBe('battery');
    expect(battery.percent).toBeGreaterThanOrEqual(0);
    expect(battery.percent).toBeLessThanOrEqual(100);
    expect(typeof battery.charging).toBe('boolean');
    expect(typeof battery.present).toBe('boolean');
  } finally {
    await app.close();
  }
});
