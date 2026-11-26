import { test, expect } from '@playwright/test';
import { launchApp } from './helpers.js';

let app;
let page;

test.beforeEach(async () => {
  ({ app } = await launchApp());
  page = await app.firstWindow();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
});
test.afterEach(async () => { await app?.close(); });

const interactive = () => app.evaluate(() => globalThis.__desktopPet.state.petWindow.interactive);

test('clicks pass through the window except over the pet', async () => {
  expect(await interactive()).toBe(false);

  // Freeze the pet in place so the pointer can find it.
  await page.evaluate(() => window.__pet.controller.dispatch({ type: 'app', process: 'Zoom', title: 'Zoom Meeting' }));
  const box = await page.locator('.pet-actor .pet-view').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
  await expect.poll(interactive).toBe(true);

  const width = page.viewportSize()?.width ?? 800;
  const away = box.x > width / 2 ? 5 : width - 5;
  await page.mouse.move(away, 5);
  await expect.poll(interactive).toBe(false);
});

test('only true or false from the pet window is accepted', async () => {
  await page.evaluate(() => window.desktopPet.setInteractive('yes please'));
  await page.waitForTimeout(200);
  expect(await interactive()).toBe(false);
  await page.evaluate(() => window.desktopPet.setInteractive(true));
  await expect.poll(interactive).toBe(true);
  await page.evaluate(() => window.desktopPet.setInteractive(false));
  await expect.poll(interactive).toBe(false);
});
