import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createConfigStore } from '../../src/main/config-store.js';
import { defaultConfig, CONFIG_VERSION } from '../../src/core/config.js';

const tempDir = () => mkdtemp(path.join(tmpdir(), 'desktop-pet-store-'));
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

test('first run creates config.json with the defaults', async () => {
  const dir = await tempDir();
  const store = createConfigStore(dir);
  const result = store.load();
  assert.equal(result.created, true);
  assert.deepEqual(result.config, defaultConfig());
  assert.deepEqual(await readJson(store.file), defaultConfig());
});

test('the folder is created if it does not exist yet', async () => {
  const dir = path.join(await tempDir(), 'nested', 'deeper');
  createConfigStore(dir).load();
  assert.deepEqual(await readdir(dir), ['config.json']);
});

test('a corrupt file is moved aside and replaced by the defaults', async () => {
  const dir = await tempDir();
  await writeFile(path.join(dir, 'config.json'), '{ "pet": "corgi", oops', 'utf8');
  const result = createConfigStore(dir).load();
  assert.ok(result.movedAside);
  assert.equal(await readFile(result.movedAside, 'utf8'), '{ "pet": "corgi", oops', 'the original is kept');
  assert.deepEqual(result.config, defaultConfig());
  assert.deepEqual(await readJson(path.join(dir, 'config.json')), defaultConfig());
});

test('an unversioned (v0) file is migrated and rewritten', async () => {
  const dir = await tempDir();
  await writeFile(path.join(dir, 'config.json'), JSON.stringify({ pet: 'robot' }), 'utf8');
  const result = createConfigStore(dir).load();
  assert.equal(result.config.pet, 'robot');
  const saved = await readJson(path.join(dir, 'config.json'));
  assert.equal(saved.version, CONFIG_VERSION);
  assert.equal(saved.pet, 'robot');
});

test('bad values fall back to defaults but the hand-edited file is left alone', async () => {
  const dir = await tempDir();
  const text = JSON.stringify({ version: CONFIG_VERSION, pet: 'dragon', idleMinutes: 7 });
  await writeFile(path.join(dir, 'config.json'), text, 'utf8');
  const result = createConfigStore(dir).load();
  assert.equal(result.config.pet, 'cat');
  assert.equal(result.config.idleMinutes, 7);
  assert.equal(result.errors[0].key, 'pet');
  assert.equal(await readFile(path.join(dir, 'config.json'), 'utf8'), text);
});

test('valid updates are saved; invalid ones are rejected whole', async () => {
  const dir = await tempDir();
  const store = createConfigStore(dir);
  store.load();
  const ok = await store.update({ pet: 'penguin', idleMinutes: 9 });
  assert.equal(ok.ok, true);
  assert.equal((await readJson(store.file)).pet, 'penguin');

  const bad = await store.update({ pet: 'axolotl', idleMinutes: 0 });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors[0].key, 'idleMinutes');
  assert.equal(store.config.pet, 'penguin', 'nothing from a rejected update is applied');
  assert.equal((await readJson(store.file)).pet, 'penguin');
});

test('concurrent updates are applied in order and leave no temp file', async () => {
  const dir = await tempDir();
  const store = createConfigStore(dir);
  store.load();
  await Promise.all(['corgi', 'penguin', 'axolotl', 'robot', 'softbot'].map((pet) => store.update({ pet })));
  assert.equal((await readJson(store.file)).pet, 'softbot');
  assert.deepEqual(await readdir(dir), ['config.json']);
});

test('a fresh store reads what an earlier one saved (restart)', async () => {
  const dir = await tempDir();
  const first = createConfigStore(dir);
  first.load();
  await first.update({ pet: 'axolotl', walkSpeed: 1.5 });
  const second = createConfigStore(dir).load();
  assert.equal(second.config.pet, 'axolotl');
  assert.equal(second.config.walkSpeed, 1.5);
  assert.equal(second.created, false);
});
