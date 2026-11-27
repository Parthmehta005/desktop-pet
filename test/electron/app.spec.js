import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { launchApp, chromiumArgs, ROOT } from './helpers.js';

test('the app starts and uses the test settings folder', async () => {
  const { app, userData } = await launchApp();
  try {
    const info = await app.evaluate(async ({ app: electronApp }) => {
      await electronApp.whenReady();
      return { ready: electronApp.isReady(), userData: electronApp.getPath('userData') };
    });
    expect(info.ready).toBe(true);
    expect(info.userData).toBe(userData);
  } finally {
    await app.close();
  }
});

test('a second copy exits straight away (single-instance lock) and opens the settings', async () => {
  const { app, userData } = await launchApp();
  try {
    await app.evaluate(({ app: electronApp }) => electronApp.whenReady());
    await (await app.firstWindow()).locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    const settingsOpened = app.waitForEvent('window');
    const started = Date.now();
    const code = await new Promise((resolve, reject) => {
      const child = spawn(electronPath, ['.', ...chromiumArgs()], {
        cwd: ROOT,
        env: { ...process.env, DESKTOP_PET_USER_DATA: userData },
        stdio: 'ignore',
      });
      const timer = setTimeout(() => { child.kill(); reject(new Error('second instance did not exit')); }, 15_000);
      child.on('exit', (exitCode) => { clearTimeout(timer); resolve(exitCode); });
    });
    expect(code).toBe(0);
    expect(Date.now() - started).toBeLessThan(15_000);
    // Launching it again (say, from the Start menu) brings up the settings.
    const settings = await settingsOpened;
    expect(settings.url()).toMatch(/\/renderer\/settings\.html$/);
  } finally {
    await app.close();
  }
});
