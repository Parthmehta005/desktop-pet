import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  isIgnoredPath, parseReflogLine, isCommitMessage, newCommits, resolveGitDir,
} from '../../src/main/sources/repo-rules.js';

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

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const line = (message) => `${A} ${B} Sam Coder <sam@example.com> 1764000000 +0100\t${message}`;

test('parseReflogLine reads a reflog entry', () => {
  assert.deepEqual(parseReflogLine(line('commit: fix the thing')), { oldSha: A, newSha: B, message: 'commit: fix the thing' });
  assert.equal(parseReflogLine('not a reflog line'), null);
  assert.equal(parseReflogLine(''), null);
  const sha256 = `${'c'.repeat(64)} ${'d'.repeat(64)} Sam <s@x> 1 +0000\tcommit: sha256 repo`;
  assert.equal(parseReflogLine(sha256).message, 'commit: sha256 repo');
});

test('only real commits count as commits', () => {
  for (const m of ['commit: add login', 'commit (initial): first', 'commit (amend): typo', 'commit (merge): Merge branch x', 'cherry-pick: fix']) {
    assert.equal(isCommitMessage(m), true, m);
  }
  for (const m of [
    'checkout: moving from main to feature', 'reset: moving to HEAD~1', 'pull: Fast-forward',
    'rebase (finish): returning to refs/heads/main', 'merge feature: Fast-forward', 'branch: Created from HEAD',
    'commit message mentioning commit: in text',
  ]) {
    assert.equal(isCommitMessage(m), false, m);
  }
});

test('newCommits picks the commits out of appended reflog text', () => {
  const text = [line('checkout: moving from main to x'), line('commit: one'), line('commit (amend): one, fixed'), ''].join('\n');
  assert.deepEqual(newCommits(text).map((c) => c.message), ['commit: one', 'commit (amend): one, fixed']);
  assert.deepEqual(newCommits(text.replace(/\n/g, '\r\n')).length, 2, 'Windows line endings');
  assert.deepEqual(newCommits(''), []);
});

test('resolveGitDir: a .git folder, or a .git file pointing elsewhere (worktrees)', () => {
  assert.equal(resolveGitDir(root, { isDirectory: true }), path.join(root, '.git'));
  assert.equal(
    resolveGitDir(root, { isDirectory: false, content: 'gitdir: /work/main/.git/worktrees/my-app\n' }),
    path.resolve('/work/main/.git/worktrees/my-app'),
  );
  assert.equal(
    resolveGitDir(root, { isDirectory: false, content: 'gitdir: ../main/.git/worktrees/my-app' }),
    path.resolve(root, '../main/.git/worktrees/my-app'),
  );
  assert.equal(resolveGitDir(root, { isDirectory: false, content: 'garbage' }), null);
});
