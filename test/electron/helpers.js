// Launching the real app for tests.
import { _electron as electron } from '@playwright/test';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Chromium can't use its OS-level sandbox when running as root (as in containers), or
 * on CI runners where chrome-sandbox isn't set up; tests then pass --no-sandbox. The
 * app itself never does.
 */
export function chromiumArgs() {
  const root = typeof process.getuid === 'function' && process.getuid() === 0;
  return process.platform === 'linux' && (root || process.env.CI) ? ['--no-sandbox'] : [];
}

export async function tempUserData() {
  return mkdtemp(path.join(tmpdir(), 'desktop-pet-test-'));
}

/**
 * Launches the app (this checkout, or a built one at `executablePath`) with its own
 * settings folder. When the test doesn't bring one, the new folder gets a config on a
 * free hook port, so test runs can share a machine (and a real pet can keep running)
 * without fighting over the default port.
 */
export async function launchApp({ userData, claudeDir, env = {}, executablePath } = {}) {
  let dir = userData;
  if (!dir) {
    dir = await tempUserData();
    await writeConfig(dir, { hookPort: await freePort() });
  }
  // Claude Code's settings folder too, so tray actions never touch the real ~/.claude.
  const claude = claudeDir ?? path.join(dir, 'claude-config');
  const app = await electron.launch({
    // A built app (executablePath) carries its own code; otherwise run this checkout.
    ...(executablePath ? { executablePath, args: chromiumArgs() } : { args: ['.', ...chromiumArgs()] }),
    cwd: ROOT,
    env: {
      ...process.env,
      DESKTOP_PET_USER_DATA: dir,
      DESKTOP_PET_TEST: '1',
      CLAUDE_CONFIG_DIR: claude,
      // Real idle time and foreground windows would change the pet mid-test; tests that
      // need those sources ask for them.
      DESKTOP_PET_SOURCES: 'files',
      ...env,
    },
  });
  await waitForStart(app);
  return { app, userData: dir, claudeDir: claude };
}

/**
 * Waits until the app has finished starting (hook token, hook server, hook status,
 * sources, shortcut). The pet window can be ready well before that on a slow machine,
 * and a test that looks at the app's state then sees it half set up.
 */
export async function waitForStart(app, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const started = await app.evaluate(() => globalThis.__desktopPet?.state.started === true).catch(() => false);
    if (started) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`the app did not finish starting within ${timeoutMs / 1000}s`);
}

/** A TCP port nothing is listening on right now. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Writes a config.json (defaults plus `changes`) before the app starts. */
export async function writeConfig(userData, changes) {
  const { defaultConfig } = await import('../../src/core/config.js');
  await writeFile(path.join(userData, 'config.json'), JSON.stringify({ ...defaultConfig(), ...changes }, null, 2));
}

export async function readConfig(userData) {
  return JSON.parse(await readFile(path.join(userData, 'config.json'), 'utf8'));
}

/**
 * Launches the app on a free hook port and waits for the pet and the hook server.
 * `options` go to launchApp (env, executablePath).
 */
export async function launchWithHooks(changes = {}, options = {}) {
  const userData = await tempUserData();
  const hookPort = await freePort();
  await writeConfig(userData, { hookPort, ...changes });
  const { app, claudeDir } = await launchApp({ ...options, userData });
  const page = await app.firstWindow();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  const { expect } = await import('@playwright/test');
  await expect.poll(() => app.evaluate(() => globalThis.__desktopPet.state.hooks.listening)).toBe(true);
  const config = await readConfig(userData);
  return { app, page, userData, claudeDir, port: hookPort, token: config.hookToken };
}

/** Posts a hook payload the way the installed curl command does. */
export function postHook({ port, token }, payload) {
  return fetch(`http://127.0.0.1:${port}/desktop-pet/claude-hook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Pet-Token': token },
    body: JSON.stringify(payload),
  });
}
