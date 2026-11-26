import { test, expect } from '@playwright/test';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { launchApp, tempUserData } from './helpers.js';
import { defaultConfig } from '../../src/core/config.js';

async function openPet(userData) {
  const { app } = await launchApp({ userData });
  const page = await app.firstWindow();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  return { app, page };
}

test('first run writes config.json with the defaults', async () => {
  const userData = await tempUserData();
  const { app } = await openPet(userData);
  await app.close();
  const saved = JSON.parse(await readFile(path.join(userData, 'config.json'), 'utf8'));
  expect(saved).toEqual(defaultConfig());
});

test('a corrupt config.json is moved aside and the pet still starts', async () => {
  const userData = await tempUserData();
  await writeFile(path.join(userData, 'config.json'), '{ definitely not json', 'utf8');
  const { app, page } = await openPet(userData);
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'cat');
  await app.close();
  const files = await readdir(userData);
  expect(files.some((f) => /^config\.corrupt-\d+\.json$/.test(f))).toBe(true);
  expect(JSON.parse(await readFile(path.join(userData, 'config.json'), 'utf8'))).toEqual(defaultConfig());
});

test('a pet change is applied live and survives a restart', async () => {
  const userData = await tempUserData();
  let { app, page } = await openPet(userData);
  const result = await app.evaluate(() => globalThis.__desktopPet.setConfig({ pet: 'penguin' }));
  expect(result.ok).toBe(true);
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'penguin');
  await app.close();

  ({ app, page } = await openPet(userData));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'penguin');
  await app.close();
});

test('invalid changes are rejected and nothing changes', async () => {
  const { app, page } = await openPet(await tempUserData());
  const result = await app.evaluate(() => globalThis.__desktopPet.setConfig({ pet: 'dragon' }));
  expect(result.ok).toBe(false);
  expect(result.errors[0].key).toBe('pet');
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'cat');
  await app.close();
});
