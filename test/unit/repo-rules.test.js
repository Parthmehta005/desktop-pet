import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { isIgnoredPath } from '../../src/main/sources/repo-rules.js';

const root = path.resolve('/work/my-app');
const at = (...parts) => path.join(root, ...parts);

test('edits to your own files count', () => {
  for (const p of [at('src', 'index.js'), at('README.md'), at('packages', 'web', 'app.tsx'), at('.github', 'ci.yml')]) {
    assert.equal(isIgnoredPath(p, root), false, p);
  }
});

test('tool output and git internals do not count', () => {
  for (const p of [
    at('node_modules', 'x', 'index.js'),
    at('packages', 'web', 'node_modules', 'y.js'),
    at('dist', 'bundle.js'),
    at('.git', 'objects', 'ab', 'cdef'),
    at('.git', 'index'),
    at('target', 'debug', 'app'),
    at('__pycache__', 'm.pyc'),
    at('.next', 'cache', 'x'),
    at('test-results', 'shot.png'),
  ]) {
    assert.equal(isIgnoredPath(p, root), true, p);
  }
});

test('the watched folder itself, and paths outside it, are never ignored by these rules', () => {
  assert.equal(isIgnoredPath(root, root), false);
  assert.equal(isIgnoredPath(path.resolve('/elsewhere/node_modules/x'), root), false);
});
