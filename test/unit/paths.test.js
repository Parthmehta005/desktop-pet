import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalPath, isAbsolutePath, samePath, isInside, findContainingFolder,
} from '../../src/core/paths.js';

test('canonicalPath: Windows drive paths are lower-cased with forward slashes', () => {
  assert.deepEqual(canonicalPath('C:\\Code\\App'), { kind: 'win', key: 'c:/code/app' });
  assert.deepEqual(canonicalPath('c:/code/app/'), { kind: 'win', key: 'c:/code/app' });
  assert.deepEqual(canonicalPath('C:\\'), { kind: 'win', key: 'c:/' });
  assert.deepEqual(canonicalPath('C:'), { kind: 'win', key: 'c:/' });
  assert.deepEqual(canonicalPath('  D:\\Work\\\\x\\  '), { kind: 'win', key: 'd:/work/x' });
});

test('canonicalPath: resolves . and .. without escaping the root', () => {
  assert.equal(canonicalPath('C:\\code\\app\\..\\other\\.\\x').key, 'c:/code/other/x');
  assert.equal(canonicalPath('C:\\..\\..\\x').key, 'c:/x');
  assert.equal(canonicalPath('/home/me/../../../etc').key, '/etc');
});

test('canonicalPath: long-path prefix and UNC shares', () => {
  assert.equal(canonicalPath('\\\\?\\C:\\Very\\Long').key, 'c:/very/long');
  assert.deepEqual(canonicalPath('\\\\Server\\Share\\Repo'), { kind: 'win', key: '//server/share/repo' });
  assert.equal(canonicalPath('\\\\server'), null, 'a UNC path needs a share');
});

test('canonicalPath: WSL paths map between Windows and Linux views', () => {
  assert.deepEqual(canonicalPath('/mnt/c/Users/Me/app'), { kind: 'win', key: 'c:/users/me/app' });
  assert.deepEqual(canonicalPath('/mnt/d'), { kind: 'win', key: 'd:/' });
  assert.deepEqual(canonicalPath('\\\\wsl$\\Ubuntu\\home\\me\\App'), { kind: 'posix', key: '/home/me/App' });
  assert.deepEqual(canonicalPath('\\\\wsl.localhost\\Ubuntu-24.04\\home\\me'), { kind: 'posix', key: '/home/me' });
  assert.deepEqual(canonicalPath('\\\\wsl$\\Ubuntu'), { kind: 'posix', key: '/' });
  assert.equal(canonicalPath('/mnt/data/x').kind, 'posix', 'only single-letter mounts are drives');
});

test('canonicalPath: POSIX paths keep their case', () => {
  assert.deepEqual(canonicalPath('/home/Me/App/'), { kind: 'posix', key: '/home/Me/App' });
  assert.deepEqual(canonicalPath('/'), { kind: 'posix', key: '/' });
});

test('canonicalPath: rejects relative paths and non-strings', () => {
  for (const bad of ['', '   ', 'app', './app', '..\\app', 'C:app', null, undefined, 42, {}]) {
    assert.equal(canonicalPath(bad), null, JSON.stringify(bad));
    assert.equal(isAbsolutePath(bad), false);
  }
});

test('isInside: Windows matching ignores case and separator style', () => {
  assert.ok(isInside('c:/code/app/src', 'C:\\Code\\App'));
  assert.ok(isInside('C:\\CODE\\APP', 'c:/code/app'));
  assert.ok(isInside('C:\\code\\app\\src\\deep\\file.js', 'C:\\code\\app\\'));
});

test('isInside: a sibling with a common prefix is not inside', () => {
  assert.equal(isInside('C:\\code\\app2', 'C:\\code\\app'), false);
  assert.equal(isInside('C:\\code\\app2\\src', 'C:\\code\\app'), false);
  assert.equal(isInside('/home/me/app-old', '/home/me/app'), false);
});

test('isInside: trailing separators on either side', () => {
  assert.ok(isInside('C:\\code\\app\\', 'C:\\code\\app'));
  assert.ok(isInside('C:\\code\\app', 'C:\\code\\app\\'));
  assert.ok(isInside('/home/me/app/', '/home/me/app'));
});

test('isInside: roots contain everything on their drive', () => {
  assert.ok(isInside('C:\\anything\\here', 'C:\\'));
  assert.ok(isInside('/home/me', '/'));
  assert.equal(isInside('D:\\x', 'C:\\'), false);
});

test('isInside: WSL sessions match Windows folders and vice versa', () => {
  assert.ok(isInside('/mnt/c/code/app', 'C:\\code\\app'));
  assert.ok(isInside('/mnt/c/Code/App/src', 'c:/code/app'));
  assert.ok(isInside('/home/me/app/src', '\\\\wsl$\\Ubuntu\\home\\me\\app'));
  assert.equal(isInside('/mnt/d/code/app', 'C:\\code\\app'), false);
});

test('isInside: POSIX matching is case-sensitive', () => {
  assert.ok(isInside('/home/me/app/src', '/home/me/app'));
  assert.equal(isInside('/home/me/App/src', '/home/me/app'), false);
});

test('isInside: Windows and POSIX paths never match each other', () => {
  assert.equal(isInside('/code/app', 'C:\\code\\app'), false);
  assert.equal(isInside('C:\\home\\me', '/home/me'), false);
});

test('isInside: invalid input is never inside anything', () => {
  assert.equal(isInside('relative/path', 'C:\\'), false);
  assert.equal(isInside('C:\\x', 'relative'), false);
  assert.equal(isInside(undefined, 'C:\\'), false);
});

test('samePath', () => {
  assert.ok(samePath('C:\\Code\\App\\', 'c:/code/app'));
  assert.ok(samePath('/mnt/c/code', 'C:\\Code'));
  assert.equal(samePath('/home/a', '/home/A'), false);
  assert.equal(samePath('nope', 'nope'), false);
});

test('findContainingFolder returns the deepest match, as configured', () => {
  const folders = ['C:\\code', 'C:\\code\\app', '/home/me/app', 'not absolute'];
  assert.equal(findContainingFolder('c:/code/app/src', folders), 'C:\\code\\app');
  assert.equal(findContainingFolder('C:\\code\\other', folders), 'C:\\code');
  assert.equal(findContainingFolder('/home/me/app/x', folders), '/home/me/app');
  assert.equal(findContainingFolder('D:\\x', folders), null);
  assert.equal(findContainingFolder('C:\\code\\x', undefined), null);
});
