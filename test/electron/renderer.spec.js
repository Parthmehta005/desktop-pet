import { test, expect } from '@playwright/test';
import { launchApp } from './helpers.js';

let app;
let page;
let errors;

test.beforeEach(async () => {
  ({ app } = await launchApp());
  page = await app.firstWindow();
  errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
});

test.afterEach(async () => { await app?.close(); });

const snapshot = () => page.evaluate(() => window.__pet.controller.snapshot());

test('the pet renders, greets and walks in the desktop window', async () => {
  await expect(page.locator('.pet-view')).toHaveAttribute('data-pet', 'cat');
  expect((await snapshot()).mood).toBe('greeting');
  await expect.poll(async () => (await snapshot()).mood, { timeout: 8000 }).toBe('wander');
  const xs = [];
  for (let i = 0; i < 10; i++) {
    xs.push(Math.round((await snapshot()).x));
    await page.waitForTimeout(250);
  }
  expect(new Set(xs).size).toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test('events from the main process reach the pet', async () => {
  await app.evaluate(() => globalThis.__desktopPet.sendToPet({ type: 'claude', hook: 'UserPromptSubmit', sessionId: 'a' }));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'working');
  await app.evaluate(() => globalThis.__desktopPet.sendToPet({ type: 'claude', hook: 'Stop', sessionId: 'a' }));
  await expect(page.locator('.pet-view')).toHaveAttribute('data-state', 'happy');
});

test('the page is see-through everywhere but the pet', async () => {
  const backgrounds = await page.evaluate(() => [
    getComputedStyle(document.documentElement).backgroundColor,
    getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.getElementById('strip')).backgroundColor,
  ]);
  expect(backgrounds).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
});

test('the window is locked down: isolation, sandbox, CSP, no Node, narrow bridge', async () => {
  const prefs = await app.evaluate(() => {
    const p = globalThis.__desktopPet.state.petWindow.win.webContents.getLastWebPreferences();
    return { contextIsolation: p.contextIsolation, sandbox: p.sandbox, nodeIntegration: p.nodeIntegration, webSecurity: p.webSecurity };
  });
  expect(prefs).toEqual({ contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true });

  const page_ = await page.evaluate(() => ({
    url: location.href,
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? '',
    require: typeof window.require,
    process: typeof window.process,
    bridge: Object.keys(window.desktopPet).sort(),
  }));
  expect(page_.url).toBe('app://desktop-pet/renderer/pet.html');
  expect(page_.csp).toContain("default-src 'none'");
  expect(page_.csp).toContain("script-src 'self'");
  expect(page_.require).toBe('undefined');
  expect(page_.process).toBe('undefined');
  expect(page_.bridge).toEqual(['getConfig', 'onConfig', 'onEvent', 'ready', 'setInteractive']);
});

test('the main process code is not reachable from the page', async () => {
  const status = await page.evaluate(async () => {
    const res = await fetch('app://desktop-pet/main/main.js').catch(() => null);
    return res ? res.status : 'blocked';
  });
  expect([404, 'blocked']).toContain(status);
});

test('inline scripts are blocked by the content security policy', async () => {
  const ran = await page.evaluate(() => new Promise((resolve) => {
    window.__inlineRan = false;
    const s = document.createElement('script');
    s.textContent = 'window.__inlineRan = true;';
    document.head.append(s);
    setTimeout(() => resolve(window.__inlineRan), 100);
  }));
  expect(ran).toBe(false);
});
