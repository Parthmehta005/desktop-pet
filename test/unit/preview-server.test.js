import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer, resolveRequestPath } from '../../scripts/preview-server.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
let server;
let base;

before(async () => {
  server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('resolveRequestPath serves only preview/ and src/', () => {
  assert.equal(resolveRequestPath('/preview/', root), path.join(root, 'preview', 'index.html'));
  assert.equal(resolveRequestPath('/src/core/moods.js', root), path.join(root, 'src', 'core', 'moods.js'));
  assert.equal(resolveRequestPath('/package.json', root), null);
  assert.equal(resolveRequestPath('/test/unit/x.js', root), null);
  assert.equal(resolveRequestPath('/node_modules/x/index.js', root), null);
});

test('resolveRequestPath blocks traversal and odd input', () => {
  for (const bad of [
    '/preview/../package.json',
    '/preview/%2e%2e/package.json',
    '/src/..%2f..%2fetc/passwd',
    '/preview/%00.js',
    '/preview/%E0%A4%A',
    '/preview/notes.txt',
    '/src',
  ]) {
    assert.equal(resolveRequestPath(bad, root), null, bad);
  }
});

test('serves files with a content type and no caching', async () => {
  const res = await fetch(`${base}/src/core/moods.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/javascript/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match(await res.text(), /export const MOODS/);
});

test('redirects / to /preview/', async () => {
  const res = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/preview/');
});

test('404 for missing or unserved files, 405 for other methods', async () => {
  assert.equal((await fetch(`${base}/preview/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/package.json`)).status, 404);
  assert.equal((await fetch(`${base}/preview/`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/preview/`, { method: 'HEAD' })).status, 200);
});
