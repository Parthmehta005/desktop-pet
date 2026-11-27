import { test, expect } from '@playwright/test';
import { launchApp, tempUserData, writeConfig } from './helpers.js';

let app;
let page;
let errors;

test.beforeEach(async () => {
  // These tests use the real clock, so switch the bedtime nudge off: otherwise between
  // 00:30 and 06:00 the pet (correctly) goes to bedtime instead of wandering.
  const userData = await tempUserData();
  await writeConfig(userData, { bedtime: null });
  ({ app } = await launchApp({ userData }));
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
  expect(page_.bridge).toEqual(['getConfig', 'onConfig', 'onEvent', 'openBatterySettings', 'ready', 'setInteractive']);
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

test('if the pet page crashes, the pet comes back; a page that keeps crashing is left alone', async () => {
  // This raises the event Electron sends when a page's process dies, rather than really
  // crashing it: after a real crash Playwright keeps its own handle on the page marked as
  // crashed even once the page is back, and now and then fails the test from inside
  // itself ("Target crashed"). Reloading a crashed page is Electron's job; what is ours is
  // deciding when to reload, which this checks.
  const gone = (reason) => app.evaluate((_, r) => {
    globalThis.__desktopPet.state.petWindow.win.webContents.emit('render-process-gone', {}, { reason: r, exitCode: 1 });
  }, reason);
  const reloads = () => app.evaluate(() => globalThis.__reloads);
  await app.evaluate(() => {
    const { petWindow } = globalThis.__desktopPet.state;
    const { webContents } = petWindow.win;
    const reload = webContents.reload.bind(webContents);
    globalThis.__reloads = 0;
    webContents.reload = () => { globalThis.__reloads += 1; return reload(); };
    petWindow.setInteractive(true); // the pointer was over the pet when it crashed
  });

  await gone('crashed');
  expect(await reloads()).toBe(1);
  await expect.poll(() => app.evaluate(async () => {
    const { webContents } = globalThis.__desktopPet.state.petWindow.win;
    if (webContents.isLoading()) return 'loading';
    try {
      return await webContents.executeJavaScript('document.body.dataset.ready ?? "starting"');
    } catch {
      return 'loading';
    }
  }), { timeout: 15_000 }).toBe('true');
  // Clicks pass through again until the pointer is over the new pet.
  expect(await app.evaluate(() => globalThis.__desktopPet.state.petWindow.interactive)).toBe(false);

  // More than three crashes in a minute: stop reloading rather than spin.
  await gone('crashed');
  await gone('oom');
  await gone('crashed');
  expect(await reloads()).toBe(3);
  // A clean exit (the app closing it) is not a crash.
  await gone('clean-exit');
  expect(await reloads()).toBe(3);
});
