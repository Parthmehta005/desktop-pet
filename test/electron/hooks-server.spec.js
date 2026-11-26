import { test, expect } from '@playwright/test';
import net from 'node:net';
import { launchApp, launchWithHooks, postHook, tempUserData, writeConfig, freePort, readConfig } from './helpers.js';

const session = (hook, extra = {}) => ({ session_id: 'e2e', cwd: process.cwd(), hook_event_name: hook, ...extra });

test('the app makes a hook token on first run and keeps it', async () => {
  const { app, userData, token } = await launchWithHooks();
  expect(token).toMatch(/^[0-9a-f]{48}$/);
  await app.close();
  const again = await launchApp({ userData });
  await again.app.firstWindow();
  await expect.poll(() => again.app.evaluate(() => globalThis.__desktopPet.state.hooks.listening)).toBe(true);
  expect((await readConfig(userData)).hookToken).toBe(token);
  await again.app.close();
});

test('Claude hook posts drive the pet; a wrong token does nothing', async () => {
  const { app, page, port, token } = await launchWithHooks();
  try {
    expect((await postHook({ port, token: 'nope' }, session('UserPromptSubmit'))).status).toBe(401);
    await page.waitForTimeout(200);
    await expect(page.locator('.pet-view')).not.toHaveAttribute('data-state', 'working');

    expect((await postHook({ port, token }, session('UserPromptSubmit'))).status).toBe(204);
    await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
    await postHook({ port, token }, session('Stop'));
    await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'happy');
  } finally {
    await app.close();
  }
});

test('sessions outside the watched folders are ignored', async () => {
  const watched = await tempUserData();
  const { app, page, port, token } = await launchWithHooks({ watchedFolders: [watched] });
  try {
    await postHook({ port, token }, session('UserPromptSubmit', { cwd: '/somewhere/else' }));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__pet.controller.snapshot().claude.working)).toBe(0);
    await postHook({ port, token }, session('UserPromptSubmit', { cwd: watched }));
    await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
  } finally {
    await app.close();
  }
});

test('a port already in use is reported and the pet still runs', async () => {
  const userData = await tempUserData();
  const port = await freePort();
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(port, '127.0.0.1', resolve));
  try {
    await writeConfig(userData, { hookPort: port });
    const { app } = await launchApp({ userData });
    const page = await app.firstWindow();
    await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
    await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.hooks.error)).toMatch(/already in use/);
    expect(await app.evaluate(() => globalThis.__desktopPet.state.hooks.listening)).toBe(false);
    await expect(page.locator('.pet-view')).toHaveCount(1);

    // Moving to a free port fixes it without a restart.
    const next = await freePort();
    expect((await app.evaluate((_, p) => globalThis.__desktopPet.setConfig({ hookPort: p }), next)).ok).toBe(true);
    await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.hooks.listening)).toBe(true);
    await app.close();
  } finally {
    blocker.close();
  }
});
