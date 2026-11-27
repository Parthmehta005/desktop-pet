// Local activity reaching the pet in the real app: edits, commits and idle time.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchApp, tempUserData, writeConfig } from './helpers.js';

function git(cwd, ...args) {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Pet Test', GIT_AUTHOR_EMAIL: 'pet@example.com',
      GIT_COMMITTER_NAME: 'Pet Test', GIT_COMMITTER_EMAIL: 'pet@example.com',
      GIT_CONFIG_NOSYSTEM: '1', HOME: cwd,
    },
  });
}

async function makeRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'desktop-pet-e2e-repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'commit.gpgsign', 'false');
  await writeFile(path.join(dir, 'README.md'), '# repo\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

async function launchWatching(folders, env = {}) {
  const userData = await tempUserData();
  await writeConfig(userData, { watchedFolders: folders, bedtime: null });
  const { app } = await launchApp({ userData, env });
  const page = await app.firstWindow();
  await page.locator('body[data-ready="true"]').waitFor({ state: 'attached' });
  await expect.poll(() => app.evaluate(() => Boolean(globalThis.__desktopPet.state.sources))).toBe(true);
  await app.evaluate(() => globalThis.__desktopPet.state.sources.repo.whenReady());
  return { app, page };
}

const mood = (page) => page.evaluate(() => window.__pet.controller.snapshot().mood);

test('editing a file makes the pet focused; committing makes it celebrate; idle puts it to sleep', async () => {
  const repo = await makeRepo();
  const { app, page } = await launchWatching([repo]);
  try {
    await expect.poll(() => mood(page), { timeout: 8000 }).toBe('wander'); // the greeting is over
    await writeFile(path.join(repo, 'app.js'), 'console.log("hi");\n');
    await expect.poll(() => mood(page), { timeout: 8000 }).toBe('focused');

    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'add app');
    await expect.poll(() => mood(page), { timeout: 8000 }).toBe('celebrating');

    // What the idle monitor sends after an hour away (it's off in tests: real idle time
    // would leak in).
    await app.evaluate(() => globalThis.__desktopPet.state.bus.emit({ type: 'idle-time', seconds: 3600 }, { source: 'idle' }));
    await expect.poll(() => mood(page), { timeout: 8000 }).toBe('sleeping');
  } finally {
    await app.close();
  }
});

test('changing the watched folders applies at once; pausing ignores edits', async () => {
  const a = await makeRepo();
  const b = await makeRepo();
  const { app, page } = await launchWatching([a]);
  try {
    expect(await app.evaluate((_, folder) => globalThis.__desktopPet.setConfig({ watchedFolders: [folder] }), b)).toMatchObject({ ok: true });
    expect(await app.evaluate(() => globalThis.__desktopPet.state.sources.repo.folders)).toEqual([b]);
    await app.evaluate(() => globalThis.__desktopPet.state.sources.repo.whenReady());

    await app.evaluate(() => globalThis.__desktopPet.actions.setPaused(true));
    await writeFile(path.join(b, 'paused.txt'), 'x');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__pet.controller.snapshot().history)).not.toContain('focused');
  } finally {
    await app.close();
  }
});

test('the idle monitor runs when enabled, and the app monitor never starts off Windows', async () => {
  const { app } = await launchWatching([], { DESKTOP_PET_SOURCES: 'files,idle,apps' });
  try {
    const seen = await app.evaluate(() => {
      const { state } = globalThis.__desktopPet;
      const types = [];
      const emit = state.bus.emit;
      state.bus.emit = (event, options) => { types.push([event.type, options.source]); return emit(event, options); };
      state.sources.idle.poll();
      state.bus.emit = emit;
      return { types, appsRunning: state.sources.apps.running, platform: process.platform };
    });
    expect(seen.types).toEqual([['idle-time', 'idle']]);
    if (seen.platform !== 'win32') expect(seen.appsRunning).toBe(false);
  } finally {
    await app.close();
  }
});
