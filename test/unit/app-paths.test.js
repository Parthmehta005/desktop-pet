import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveAppPath, rendererUrl, SRC_ROOT } from '../../src/main/app-paths.js';

test('serves renderer and core files', () => {
  assert.equal(resolveAppPath('/renderer/pet.html'), path.join(SRC_ROOT, 'renderer', 'pet.html'));
  assert.equal(resolveAppPath('/core/engine.js'), path.join(SRC_ROOT, 'core', 'engine.js'));
  assert.equal(resolveAppPath('/renderer/pets/cat.js'), path.join(SRC_ROOT, 'renderer', 'pets', 'cat.js'));
});

test('never serves the main process, traversal, or odd files', () => {
  for (const bad of [
    '/main/main.js',
    '/main/preload.cjs',
    '/renderer/../main/main.js',
    '/renderer/%2e%2e/main/main.js',
    '/renderer/..%2fmain%2fmain.js',
    '/renderer\\..\\main\\main.js',
    '/renderer/%00pet.html',
    '/renderer/%E0%A4%A',
    '/renderer/notes.txt',
    '/renderer',
    '/',
  ]) {
    assert.equal(resolveAppPath(bad), null, bad);
  }
});

test('rendererUrl', () => {
  assert.equal(rendererUrl('pet.html'), 'app://desktop-pet/renderer/pet.html');
});
