// The repo watcher against real folders and real git repos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, appendFile } from 'node:fs/promises';
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
  const commits = [];
  const watcher = createRepoWatcher({
    onActivity: (folder) => activity.push(folder),
    onCommit: (folder, root) => commits.push({ folder, root }),
    throttleMs: 1000,
    ...options,
  });
  await watcher.setFolders(folders);
  await watcher.whenReady();
  return { watcher, activity, commits };
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

test('a new commit is a celebration; checkout, status and branch are not', async () => {
  const repo = await makeRepo();
  const w = await watching([repo]);
  try {
    git(repo, 'status');
    git(repo, 'checkout', '-q', '-b', 'feature');
    git(repo, 'branch', 'other');
    await sleep(1200);
    assert.deepEqual(w.commits, [], 'no celebration without a commit');

    await writeFile(path.join(repo, 'a.txt'), 'a');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'add a');
    assert.ok(await until(() => w.commits.length === 1), 'the commit is noticed');
    assert.deepEqual(w.commits[0], { folder: repo, root: repo });

    git(repo, 'commit', '-q', '--amend', '-m', 'add a (better)');
    assert.ok(await until(() => w.commits.length === 2), 'an amend counts too');
  } finally {
    await w.watcher.close();
  }
});

test('commits in a worktree are noticed', async () => {
  const main = await makeRepo();
  const tree = `${main}-wt`;
  git(main, 'worktree', 'add', '-q', '-b', 'wt-branch', tree);
  const w = await watching([tree]);
  try {
    await writeFile(path.join(tree, 'b.txt'), 'b');
    git(tree, 'add', '.');
    git(tree, 'commit', '-q', '-m', 'in the worktree');
    assert.ok(await until(() => w.commits.length === 1));
    assert.equal(w.commits[0].root, tree);
  } finally {
    await w.watcher.close();
  }
});

test('a folder of repos: commits in any repo one level down are noticed', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'desktop-pet-code-'));
  const one = await makeRepo(parent, 'one');
  await makeRepo(parent, 'two');
  const w = await watching([parent]);
  try {
    await appendFile(path.join(one, 'README.md'), 'more\n');
    git(one, 'commit', '-q', '-am', 'more');
    assert.ok(await until(() => w.commits.length === 1));
    assert.deepEqual(w.commits[0], { folder: parent, root: one });
  } finally {
    await w.watcher.close();
  }
});

test('the first commit in a brand-new repo is noticed', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desktop-pet-new-'));
  git(dir, 'init', '-q', '-b', 'main');
  const w = await watching([dir]);
  try {
    await writeFile(path.join(dir, 'x.txt'), 'x');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'first ever');
    assert.ok(await until(() => w.commits.length === 1));
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
