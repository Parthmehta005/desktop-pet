import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { enabledSources, createSources, SOURCE_NAMES } from '../../src/main/sources/index.js';

test('enabledSources: all by default, or the listed ones', () => {
  assert.deepEqual([...enabledSources(undefined)], [...SOURCE_NAMES]);
  assert.deepEqual([...enabledSources('files')], ['files']);
  assert.deepEqual([...enabledSources(' idle , apps,bogus')], ['idle', 'apps']);
  assert.deepEqual([...enabledSources('')], []);
});

test('disabled sources are not created; enabled ones route through the bus with their source name', async () => {
  const emitted = [];
  const bus = { emit: (event, { source }) => { emitted.push([event.type, source]); return true; } };
  const pm = new EventEmitter();
  pm.getSystemIdleTime = () => 7;
  const sources = createSources({ bus, powerMonitor: pm, enabled: new Set(['idle']) });
  assert.equal(sources.repo, null);
  assert.equal(sources.apps, null);
  await sources.start({ watchedFolders: [] });
  pm.emit('lock-screen');
  await sources.stop();
  assert.deepEqual(emitted, [['idle-time', 'idle'], ['lock', 'idle']]);
});
