// The repo watcher against real folders and real git repos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRepoWatcher } from '../../src/main/sources/repo-watcher.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(check, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (check()) return true;
    await sleep(50);
  }
  return check();
}

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Pet Test', GIT_AUTHOR_EMAIL: 'pet@example.com',
      GIT_COMMITTER_NAME: 'Pet Test', GIT_COMMITTER_EMAIL: 'pet@example.com',
      GIT_CONFIG_NOSYSTEM: '1', HOME: cwd,
    },
  }).toString();
}

async function makeRepo(parent = null, name = 'repo') {
  const dir = parent ? path.join(parent, name) : await mkdtemp(path.join(tmpdir(), 'desktop-pet-repo-'));
  await mkdir(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'commit.gpgsign', 'false');
  await writeFile(path.join(dir, 'README.md'), '# test\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'first');
  return dir;
}

async function watching(folders, options = {}) {
  const activity = [];
  const watcher = createRepoWatcher({
    onActivity: (folder) => activity.push(folder),
    throttleMs: 1000,
    ...options,
  });
  await watcher.setFolders(folders);
  await watcher.whenReady();
  return { watcher, activity };
}

test('editing a file is reported, and a burst of edits counts once', async () => {
  const repo = await makeRepo();
  const w = await watching([repo]);
  try {
    for (let i = 0; i < 20; i++) await writeFile(path.join(repo, `file${i}.js`), `// ${i}\n`);
    assert.ok(await until(() => w.activity.length > 0), 'an edit is noticed');
    await sleep(500);
    assert.deepEqual(w.activity, [repo], 'twenty quick edits are one burst');
  } finally {
    await w.watcher.close();
  }
});

test('changes in node_modules, dist or .git/objects are not editing', async () => {
  const repo = await makeRepo();
  await mkdir(path.join(repo, 'node_modules', 'pkg'), { recursive: true });
  await mkdir(path.join(repo, 'dist'), { recursive: true });
  const w = await watching([repo]);
  try {
    await writeFile(path.join(repo, 'node_modules', 'pkg', 'index.js'), 'x');
    await writeFile(path.join(repo, 'dist', 'bundle.js'), 'x');
    await writeFile(path.join(repo, '.git', 'objects', 'stray'), 'x');
    await sleep(1500);
    assert.deepEqual(w.activity, []);
  } finally {
    await w.watcher.close();
  }
});

test('folders can be added and removed while running', async () => {
  const a = await makeRepo();
  const b = await makeRepo();
  const w = await watching([a]);
  try {
    await w.watcher.setFolders([b]);
    await w.watcher.whenReady();
    assert.deepEqual(w.watcher.folders, [b]);
    await writeFile(path.join(a, 'ignored-now.txt'), 'x');
    await writeFile(path.join(b, 'noticed.txt'), 'x');
    assert.ok(await until(() => w.activity.includes(b)));
    await sleep(400);
    assert.equal(w.activity.includes(a), false, 'a removed folder is no longer watched');
  } finally {
    await w.watcher.close();
  }
});

test('a folder that does not exist does not crash the watcher', async () => {
  const errors = [];
  const w = await watching([path.join(tmpdir(), 'definitely-not-here-desktop-pet')], { onError: (e) => errors.push(e) });
  await w.watcher.close();
  assert.ok(true);
});
