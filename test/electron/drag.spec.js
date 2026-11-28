// Carrying the pet: while it's held or falling, its window fills the work area, so it can
// be lifted anywhere above the taskbar. Once it lands the window is a strip again.
import { test, expect } from '@playwright/test';
import { launchApp } from './helpers.js';
import { stripBounds, HEADROOM } from '../../src/core/layout.js';

let app;
let page;

test.beforeEach(async () => {
  ({ app } = await launchApp());
  page = await app.firstWindow();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
});
test.afterEach(async () => { await app?.close(); });

const windowState = () => app.evaluate(({ screen }) => {
  const { petWindow } = globalThis.__desktopPet.state;
  return { bounds: petWindow.win.getBounds(), lifted: petWindow.lifted, workArea: screen.getPrimaryDisplay().workArea };
});
const snapshot = () => page.evaluate(() => window.__pet.controller.snapshot());

async function pickUp() {
  const box = await page.locator('.pet-actor .pet-view').boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y - 30, { steps: 5 });
}

test('the pet can be carried far above the strip, and the window shrinks back once it lands', async () => {
  const { workArea, bounds } = await windowState();
  expect(bounds).toEqual(stripBounds(workArea, 1));

  await pickUp();
  await expect.poll(async () => (await windowState()).bounds).toEqual(stripBounds(workArea, 1, { lifted: true }));
  expect(workArea.height, 'room to lift it well above the strip').toBeGreaterThan(stripBounds(workArea, 1).height + 300);

  // The window grew upwards, so the strip's top is now near the top of the screen.
  const strip = await page.locator('#strip').boundingBox();
  await page.mouse.move(strip.x + strip.width / 2, strip.y + 80, { steps: 10 });
  const held = await snapshot();
  expect(held.dragging).toBe(true);
  expect(held.mood).toBe('held');
  expect(held.lift, 'higher than the old limit of the strip').toBeGreaterThan(HEADROOM + 300);

  await page.mouse.up();
  await expect.poll(async () => (await snapshot()).lift, { timeout: 5000 }).toBe(0);
  await expect.poll(async () => (await windowState()).bounds).toEqual(stripBounds(workArea, 1));
  expect((await windowState()).lifted).toBe(false);
  expect((await snapshot()).mood).not.toBe('falling');
});

test('a click on the pet pets it and leaves the window as a strip', async () => {
  const { workArea } = await windowState();
  const box = await page.locator('.pet-actor .pet-view').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await expect.poll(async () => (await snapshot()).history).toContain('petted');
  await page.waitForTimeout(300);
  expect((await windowState()).bounds).toEqual(stripBounds(workArea, 1));
});

test('if the pet page reloads while the pet is carried, the window goes back to a strip', async () => {
  const { workArea } = await windowState();
  await pickUp();
  await expect.poll(async () => (await windowState()).lifted).toBe(true);
  await page.reload();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  await expect.poll(async () => (await windowState()).bounds).toEqual(stripBounds(workArea, 1));
  expect((await windowState()).lifted).toBe(false);
});

test('only true or false from the pet window can grow it', async () => {
  const { workArea } = await windowState();
  await page.evaluate(() => window.desktopPet.setLifted('please'));
  await page.waitForTimeout(200);
  expect((await windowState()).lifted).toBe(false);
  // Another window asking is ignored.
  await app.evaluate(({ ipcMain, BrowserWindow }) => {
    const other = new BrowserWindow({ show: false });
    ipcMain.emit('pet:lifted', { sender: other.webContents }, true);
    other.destroy();
  });
  await page.waitForTimeout(200);
  expect((await windowState()).bounds).toEqual(stripBounds(workArea, 1));
  await page.evaluate(() => window.desktopPet.setLifted(true));
  await expect.poll(async () => (await windowState()).lifted).toBe(true);
  await page.evaluate(() => window.desktopPet.setLifted(false));
  await expect.poll(async () => (await windowState()).bounds).toEqual(stripBounds(workArea, 1));
});
