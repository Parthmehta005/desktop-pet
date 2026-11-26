// Launching the real app for tests.
import { _electron as electron } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
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

/** Launches the app with its own settings folder. */
export async function launchApp({ userData, env = {} } = {}) {
  const dir = userData ?? await tempUserData();
  const app = await electron.launch({
    args: ['.', ...chromiumArgs()],
    cwd: ROOT,
    env: { ...process.env, DESKTOP_PET_USER_DATA: dir, DESKTOP_PET_TEST: '1', ...env },
  });
  return { app, userData: dir };
}
