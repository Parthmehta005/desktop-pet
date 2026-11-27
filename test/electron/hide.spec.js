// Quick hide and show: the tray item, moods carrying on while hidden, a second launch,
// and a restart.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { launchApp, chromiumArgs, ROOT } from './helpers.js';

async function launch(options) {
  const launched = await launchApp(options);
  const pet = await launched.app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { ...launched, pet };
}

const visible = (app) => app.evaluate(() => globalThis.__desktopPet.state.petWindow.win.isVisible());
const hideItem = (app) => app.evaluate(() => globalThis.__desktopPet.trayMenu()[1].label);
const clickHideItem = (app) => app.evaluate(() => globalThis.__desktopPet.trayMenu()[1].click());

test('the tray item hides the pet and shows it again, and says which it will do', async () => {
  const { app } = await launch();
  try {
    await expect.poll(() => visible(app)).toBe(true);
    expect(await hideItem(app)).toBe('Hide pet');
    await clickHideItem(app);
    await expect.poll(() => visible(app)).toBe(false);
    expect(await hideItem(app)).toBe('Show pet');
    await clickHideItem(app);
    await expect.poll(() => visible(app)).toBe(true);
    expect(await hideItem(app)).toBe('Hide pet');
  } finally {
    await app.close();
  }
});

test('while hidden the pet keeps up, so it comes back in the right mood', async () => {
  const { app, pet } = await launch();
  try {
    await app.evaluate(() => globalThis.__desktopPet.actions.setHidden(true));
    await expect.poll(() => visible(app)).toBe(false);
    await app.evaluate(() => globalThis.__desktopPet.state.bus.emit(
      { type: 'claude', hook: 'UserPromptSubmit', sessionId: 'hidden' }, { source: 'claude' }));
    await expect.poll(() => pet.evaluate(() => window.__pet.controller.snapshot().mood)).toBe('working');
    await app.evaluate(() => globalThis.__desktopPet.actions.setHidden(false));
    await expect.poll(() => visible(app)).toBe(true);
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-state', 'working');
  } finally {
    await app.close();
  }
});

test('starting the app again while the pet is hidden brings it back', async () => {
  const { app, userData } = await launch();
  try {
    await app.evaluate(() => globalThis.__desktopPet.actions.setHidden(true));
    await expect.poll(() => visible(app)).toBe(false);
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
    await expect.poll(() => visible(app)).toBe(true);
  } finally {
    await app.close();
  }
});

test('after a restart the pet is shown, even if it was hidden', async () => {
  const first = await launch();
  await first.app.evaluate(() => globalThis.__desktopPet.actions.setHidden(true));
  await expect.poll(() => visible(first.app)).toBe(false);
  await first.app.close();
  const again = await launch({ userData: first.userData });
  try {
    await expect.poll(() => visible(again.app)).toBe(true);
    expect(await hideItem(again.app)).toBe('Hide pet');
  } finally {
    await again.app.close();
  }
});
