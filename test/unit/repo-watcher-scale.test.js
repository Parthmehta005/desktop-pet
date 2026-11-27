// A big folder must not keep the pet busy: once the first scan is done, watching
// 10,000 files should cost next to nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRepoWatcher } from '../../src/main/sources/repo-watcher.js';

test('watching 10,000 files is quiet once the first scan finishes', { timeout: 120_000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desktop-pet-big-'));
  for (let d = 0; d < 100; d++) {
    const dir = path.join(root, `dir${d}`);
    await mkdir(dir);
    await Promise.all(Array.from({ length: 100 }, (_, f) => writeFile(path.join(dir, `file${f}.txt`), 'x')));
  }
  const activity = [];
  const watcher = createRepoWatcher({ onActivity: (f) => activity.push(f), onCommit: () => {} });
  try {
    const scanStart = Date.now();
    await watcher.setFolders([root]);
    await watcher.whenReady();
    const scanMs = Date.now() - scanStart;

    const before = process.cpuUsage();
    await new Promise((r) => setTimeout(r, 3000));
    const used = process.cpuUsage(before);
    const cpuMs = (used.user + used.system) / 1000;
    console.log(`10,000 files: first scan ${scanMs} ms, then ${cpuMs.toFixed(1)} ms CPU over 3 s idle`);
    assert.deepEqual(activity, [], 'no events without changes');
    assert.ok(cpuMs < 300, `idle CPU ${cpuMs} ms over 3 s`);
  } finally {
    await watcher.close();
  }
});
