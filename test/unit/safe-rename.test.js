// Saving settings on Windows while something else has the file open: the rename that
// replaces it is retried for a while instead of failing (and losing the change).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { renameWithRetry, renameSyncWithRetry, RETRY_DELAYS_MS } from '../../src/main/safe-rename.js';
import { createConfigStore } from '../../src/main/config-store.js';

const locked = (code = 'EPERM') => Object.assign(new Error(`${code}: operation not permitted, rename`), { code });

/** A rename that fails `times` times with `code`, then works. */
function flakyRename(times, code) {
  const calls = [];
  return {
    calls,
    rename: async (a, b) => { calls.push([a, b]); if (calls.length <= times) throw locked(code); },
    renameSync: (a, b) => { calls.push([a, b]); if (calls.length <= times) throw locked(code); },
  };
}

test('on Windows a locked file is retried until the rename works', async () => {
  for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
    const r = flakyRename(3, code);
    const waits = [];
    await renameWithRetry('a', 'b', { platform: 'win32', rename: r.rename, wait: async (ms) => { waits.push(ms); } });
    assert.equal(r.calls.length, 4, code);
    assert.deepEqual(waits, RETRY_DELAYS_MS.slice(0, 3));
  }
});

test('it gives up after about two seconds, with the original error', async () => {
  const r = flakyRename(Infinity, 'EPERM');
  const waits = [];
  await assert.rejects(
    renameWithRetry('a', 'b', { platform: 'win32', rename: r.rename, wait: async (ms) => { waits.push(ms); } }),
    { code: 'EPERM' },
  );
  assert.equal(r.calls.length, RETRY_DELAYS_MS.length + 1);
  const total = waits.reduce((a, b) => a + b, 0);
  assert.ok(total >= 1500 && total <= 2500, `${total} ms`);
});

test('elsewhere, and for other errors, it fails at once', async () => {
  const posix = flakyRename(1, 'EACCES');
  await assert.rejects(renameWithRetry('a', 'b', { platform: 'linux', rename: posix.rename, wait: async () => {} }), { code: 'EACCES' });
  assert.equal(posix.calls.length, 1, 'on Linux EACCES is a real permission problem');
  const missing = flakyRename(1, 'ENOENT');
  await assert.rejects(renameWithRetry('a', 'b', { platform: 'win32', rename: missing.rename, wait: async () => {} }), { code: 'ENOENT' });
  assert.equal(missing.calls.length, 1);
});

test('the blocking version used at start-up retries the same way', () => {
  const r = flakyRename(2, 'EBUSY');
  const waits = [];
  renameSyncWithRetry('a', 'b', { platform: 'win32', renameSync: r.renameSync, waitSync: (ms) => waits.push(ms) });
  assert.equal(r.calls.length, 3);
  assert.deepEqual(waits, RETRY_DELAYS_MS.slice(0, 2));
});

test('a settings save survives the file being locked for a moment', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desktop-pet-lock-'));
  let failures = 2;
  const { rename } = await import('node:fs/promises');
  const store = createConfigStore(dir, {
    renameAsync: (a, b) => renameWithRetry(a, b, {
      platform: 'win32',
      wait: async () => {},
      rename: async (x, y) => { if (failures-- > 0) throw locked('EPERM'); return rename(x, y); },
    }),
  });
  store.load();
  const result = await store.update({ pet: 'corgi' });
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8')).pet, 'corgi');
});

test('a save that still fails leaves the old settings in place and reports the error', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'desktop-pet-lock-'));
  const store = createConfigStore(dir, { renameAsync: async () => { throw locked('EPERM'); } });
  store.load();
  await assert.rejects(store.update({ pet: 'corgi' }), { code: 'EPERM' });
  assert.equal(store.config.pet, 'cat', 'the app keeps what is on disk');
  assert.equal(JSON.parse(await readFile(path.join(dir, 'config.json'), 'utf8')).pet, 'cat');
  // and the next save still works
  const ok = createConfigStore(dir);
  ok.load();
  assert.equal((await ok.update({ pet: 'penguin' })).ok, true);
});
