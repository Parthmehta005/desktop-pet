import { test, expect } from '@playwright/test';
import { launchApp } from './helpers.js';
import { stripBounds } from '../../src/core/layout.js';

let app;
test.beforeEach(async () => { ({ app } = await launchApp()); });
test.afterEach(async () => { await app?.close(); });

async function petWindowInfo() {
  await app.firstWindow();
  return app.evaluate(({ screen }) => {
    const { state, PET_WINDOW_OPTIONS } = globalThis.__desktopPet;
    const win = state.petWindow.win;
    return {
      options: PET_WINDOW_OPTIONS,
      bounds: win.getBounds(),
      workArea: screen.getPrimaryDisplay().workArea,
      alwaysOnTop: win.isAlwaysOnTop(),
      resizable: win.isResizable(),
      focusable: win.isFocusable(),
    };
  });
}

test('the pet window is a transparent, frameless, always-on-top strip', async () => {
  const info = await petWindowInfo();
  expect(info.options).toMatchObject({
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
  });
  expect(info.alwaysOnTop).toBe(true);
  expect(info.resizable).toBe(false);
  expect(info.focusable).toBe(false);
});

test('the strip sits along the bottom of the primary work area', async () => {
  const info = await petWindowInfo();
  expect(info.bounds).toEqual(stripBounds(info.workArea, 1));
  expect(info.bounds.y + info.bounds.height).toBe(info.workArea.y + info.workArea.height);
  expect(info.bounds.width).toBe(info.workArea.width);
});

test('a display change moves and resizes the strip', async () => {
  await petWindowInfo();
  const fake = { x: 0, y: 0, width: 1000, height: 700 };
  const bounds = await app.evaluate((_, workArea) => {
    const { state } = globalThis.__desktopPet;
    state.petWindow.relayout(workArea);
    return state.petWindow.win.getBounds();
  }, fake);
  expect(bounds).toEqual(stripBounds(fake, 1));
});
