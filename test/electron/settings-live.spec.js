// Every setting in the window, and changes taking effect without a restart.
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { launchApp } from './helpers.js';
import { CONFIG_KEYS, CONFIG_SCHEMA } from '../../src/core/config.js';
import { BASE_PET_SIZE, stripHeight } from '../../src/core/layout.js';

async function setup() {
  const { app, userData } = await launchApp();
  const pet = await app.firstWindow();
  await pet.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  const [win] = await Promise.all([
    app.waitForEvent('window'),
    app.evaluate(() => { globalThis.__desktopPet.actions.openSettings(); }),
  ]);
  await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { app, pet, win, userData };
}

const mood = (pet) => pet.evaluate(() => window.__pet.controller.snapshot().mood);
const emit = (app, event) => app.evaluate((_, e) => globalThis.__desktopPet.state.bus.emit(e, { source: 'test' }), event);

test('every user-facing setting has a control in the window, and ids are unique', async () => {
  const { app, win } = await setup();
  try {
    const fields = await win.locator('[data-field]').evaluateAll((els) => els.map((el) => el.dataset.field));
    expect([...fields].sort()).toEqual(CONFIG_KEYS.filter((k) => !CONFIG_SCHEMA[k].internal).sort());
    const ids = await win.locator('[id]').evaluateAll((els) => els.map((el) => el.id));
    expect(ids.length).toBe(new Set(ids).size);
    // Every field's label names a real form control.
    const unlabelled = await win.locator('label.field-label').evaluateAll((labels) => labels
      .filter((l) => !l.control).map((l) => l.textContent));
    expect(unlabelled).toEqual([]);
    // Compound fields name their group, and their buttons keep their own names.
    await expect(win.getByRole('group', { name: 'Watched folders' })).toBeVisible();
    await expect(win.getByRole('group', { name: 'App rules' })).toBeVisible();
    await expect(win.getByRole('button', { name: 'Add folder...' })).toBeVisible();
    await expect(win.getByRole('button', { name: 'Add rule' })).toBeVisible();
  } finally {
    await app.close();
  }
});

test('pet size resizes the window strip and the pet at once', async () => {
  const { app, pet, win } = await setup();
  try {
    // Playwright can't type into a slider; set it the way dragging would.
    await win.getByLabel('Size', { exact: true }).evaluate((el) => {
      el.value = '1.5';
      el.dispatchEvent(new Event('input'));
      el.dispatchEvent(new Event('change'));
    });
    await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.petWindow.win.getBounds().height))
      .toBe(stripHeight(1.5));
    await expect.poll(() => pet.evaluate(() => window.__pet.controller.snapshot().petSize)).toBe(Math.round(BASE_PET_SIZE * 1.5));
  } finally {
    await app.close();
  }
});

test('behaviour settings change the pet straight away', async () => {
  const { app, pet, win } = await setup();
  try {
    await expect.poll(() => mood(pet), { timeout: 8000 }).not.toBe('greeting');
    // Idle threshold: 400 idle seconds is asleep at 5 minutes, awake at 10.
    await emit(app, { type: 'idle-time', seconds: 400 });
    await expect.poll(() => mood(pet)).toBe('sleeping');
    const idle = win.getByLabel('Fall asleep after');
    await idle.fill('10');
    await idle.press('Tab');
    await expect.poll(() => mood(pet)).not.toBe('sleeping');
    await emit(app, { type: 'idle-time', seconds: 0 });

    // Meetings: quiet mode can be switched off.
    await emit(app, { type: 'app', process: 'Zoom', title: 'Zoom Meeting' });
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-meeting', 'true');
    await win.getByLabel('Quiet during meetings').uncheck();
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-meeting', 'false');

    // Fullscreen hiding can be switched off.
    await emit(app, { type: 'app', process: 'game', title: 'Game', fullscreen: true });
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-hidden', 'true');
    await win.getByLabel('Hide when something is fullscreen').uncheck();
    await expect(pet.locator('.pet-view')).toHaveAttribute('data-hidden', 'false');
    await emit(app, { type: 'app', process: 'Code', title: 'editor' });

    // Bedtime: a window around "now" brings the nightcap out; switching it off ends it.
    const now = new Date();
    const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const bed = win.getByLabel('Bedtime', { exact: true });
    await win.getByLabel('On', { exact: true }).check();
    await bed.fill(hhmm(new Date(now.getTime() - 60_000)));
    await bed.dispatchEvent('change');
    await win.getByLabel('Morning').fill(hhmm(new Date(now.getTime() + 3_600_000)));
    await win.getByLabel('Morning').dispatchEvent('change');
    await expect.poll(() => mood(pet)).toBe('bedtime');
    await win.getByLabel('On', { exact: true }).uncheck();
    await expect.poll(() => mood(pet)).not.toBe('bedtime');
  } finally {
    await app.close();
  }
});

test('the settings window renders cleanly (screenshot for review)', async () => {
  const { app, win } = await setup();
  const errors = [];
  win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  win.on('pageerror', (e) => errors.push(e.message));
  try {
    await win.setViewportSize({ width: 880, height: 1400 });
    await win.reload();
    await win.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    await mkdir('test-results/screenshots', { recursive: true });
    await win.screenshot({ path: 'test-results/screenshots/settings-window.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
