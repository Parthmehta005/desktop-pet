import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchWithHooks } from './helpers.js';

test('install and remove the Claude Code hooks from the tray (into a temp Claude folder)', async () => {
  const { app, claudeDir } = await launchWithHooks();
  const pet = (fn) => app.evaluate(fn);
  try {
    await expect.poll(() => pet(() => globalThis.__desktopPet.state.hookInstall.status)).toBe('not-installed');
    const installed = await pet(() => globalThis.__desktopPet.actions.installHooks());
    expect(installed.ok).toBe(true);
    expect(installed.settingsPath).toBe(path.join(claudeDir, 'settings.json'));
    expect(await pet(() => globalThis.__desktopPet.state.hookInstall.status)).toBe('installed');
    expect(await pet(() => globalThis.__desktopPet.trayMenu().map((m) => m.label))).toContain('Claude Code: connected');

    const removed = await pet(() => globalThis.__desktopPet.actions.uninstallHooks());
    expect(removed.ok).toBe(true);
    expect(await pet(() => globalThis.__desktopPet.state.hookInstall.status)).toBe('not-installed');
    expect(JSON.parse(await readFile(path.join(claudeDir, 'settings.json'), 'utf8'))).toEqual({});
  } finally {
    await app.close();
  }
});
