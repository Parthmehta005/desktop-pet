import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_SCHEMA, CONFIG_KEYS, CONFIG_VERSION, defaultConfig, validateConfig, migrateConfig,
  parseConfig, serializeConfig,
} from '../../src/core/config.js';
import { ENGINE_DEFAULTS } from '../../src/core/engine.js';
import { DEFAULT_APP_RULES } from '../../src/core/app-rules.js';
import { PETS, PET_IDS, petById } from '../../src/core/pets.js';

test('there are five pets with unique ids and names', () => {
  assert.deepEqual([...PET_IDS], ['cat', 'penguin', 'bluepanda', 'bee', 'bat']);
  assert.equal(new Set(PETS.map((p) => p.name)).size, 5);
  assert.equal(petById('bluepanda').name, 'Maple');
  assert.equal(petById('bluepanda').species, 'Blue panda');
  assert.equal(petById('dragon'), null);
});

test('a saved pet that was removed after 1.0.0 falls back to Mochi, and the rest is kept', () => {
  for (const removed of ['corgi', 'axolotl', 'robot', 'softbot']) {
    const parsed = parseConfig(JSON.stringify({ version: CONFIG_VERSION, pet: removed, idleMinutes: 12, watchedFolders: ['C:\\code'] }));
    assert.equal(parsed.config.pet, 'cat', removed);
    assert.equal(parsed.config.idleMinutes, 12, 'the other settings are kept');
    assert.deepEqual(parsed.config.watchedFolders, ['C:\\code']);
    assert.equal(parsed.corrupt, false, 'not treated as a corrupt file');
    assert.deepEqual(parsed.errors.map((e) => e.key), ['pet'], 'reported, for the log');
  }
});

test('the defaults are valid and complete', () => {
  const config = defaultConfig();
  assert.equal(config.version, CONFIG_VERSION);
  assert.deepEqual(Object.keys(config).sort(), ['version', ...CONFIG_KEYS].sort());
  const { config: validated, errors, dropped } = validateConfig(config);
  assert.deepEqual(errors, []);
  assert.deepEqual(dropped, []);
  assert.deepEqual(validated, config);
});

test('defaultConfig returns fresh copies, never the shared defaults', () => {
  const a = defaultConfig();
  a.watchedFolders.push('C:\\x');
  a.appRules[0].mood = 'gaming';
  const b = defaultConfig();
  assert.deepEqual(b.watchedFolders, []);
  assert.equal(b.appRules[0].mood, DEFAULT_APP_RULES[0].mood);
});

test('engine defaults agree with config defaults', () => {
  for (const key of Object.keys(ENGINE_DEFAULTS)) {
    assert.ok(key in CONFIG_SCHEMA, `${key} is a config key`);
    assert.deepEqual(ENGINE_DEFAULTS[key], CONFIG_SCHEMA[key].default, key);
  }
});

test('every schema field has a default that passes its own validation', () => {
  for (const key of CONFIG_KEYS) {
    const { errors } = validateConfig({ [key]: CONFIG_SCHEMA[key].default });
    assert.deepEqual(errors, [], key);
  }
});

test('missing keys get defaults; unknown keys are dropped', () => {
  const { config, errors, dropped } = validateConfig({ pet: 'penguin', colour: 'blue', version: 1 });
  assert.equal(config.pet, 'penguin');
  assert.equal(config.idleMinutes, 5);
  assert.equal(config.colour, undefined);
  assert.deepEqual(dropped, ['colour']);
  assert.deepEqual(errors, []);
});

test('bad values fall back to the default and are reported', () => {
  const { config, errors } = validateConfig({
    pet: 'dragon',
    shuffleDaily: 'yes',
    idleMinutes: 0,
    workingStaleMinutes: 2.5,
    breakReminderMinutes: '90',
    petSize: 9,
    walkSpeed: Number.NaN,
    bedtime: '25:00',
    wakeTime: null,
    hookPort: 80,
    hookToken: 'has spaces',
    watchedFolders: 'C:\\code',
    appRules: { mood: 'vibing' },
    toggleShortcut: 'Shift+P',
  });
  const byKey = Object.fromEntries(errors.map((e) => [e.key, e.message]));
  assert.match(byKey.pet, /one of cat, penguin, bluepanda, bee, bat/);
  assert.match(byKey.shuffleDaily, /true or false/);
  assert.match(byKey.idleMinutes, /between 1 and 240/);
  assert.match(byKey.workingStaleMinutes, /whole number/);
  assert.match(byKey.breakReminderMinutes, /must be a number/);
  assert.match(byKey.petSize, /between 0.5 and 2/);
  assert.match(byKey.walkSpeed, /must be a number/);
  assert.match(byKey.bedtime, /time like "00:30" or null/);
  assert.match(byKey.wakeTime, /time like "00:30"$/, 'wakeTime cannot be null');
  assert.match(byKey.hookPort, /between 1024 and 65535/);
  assert.match(byKey.hookToken, /letters, digits/);
  assert.match(byKey.watchedFolders, /list of folders/);
  assert.match(byKey.appRules, /list of rules/);
  assert.match(byKey.toggleShortcut, /needs Ctrl, Alt or the Windows key/);
  assert.deepEqual(
    { ...config, appRules: undefined },
    { ...defaultConfig(), appRules: undefined },
    'every bad value was replaced by its default',
  );
});

test('bedtime can be null to switch the nudge off', () => {
  const { config, errors } = validateConfig({ bedtime: null });
  assert.equal(config.bedtime, null);
  assert.deepEqual(errors, []);
});

test('breakReminderMinutes can be 0 to switch the reminder off', () => {
  assert.deepEqual(validateConfig({ breakReminderMinutes: 0 }).errors, []);
});

test('watched folders: bad entries are dropped one by one, duplicates merged', () => {
  const { config, errors } = validateConfig({
    watchedFolders: ['C:\\code\\app', 'relative\\path', 'c:/code/app/', 42, '  /mnt/c/code/app  ', '/home/me/x'],
  });
  assert.deepEqual(config.watchedFolders, ['C:\\code\\app', '/home/me/x'],
    'c:/code/app/ and /mnt/c/code/app are the same folder');
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /entry 2 is not an absolute folder path/);
  assert.match(errors[1].message, /entry 4/);
});

test('watched folders: capped at 50', () => {
  const folders = Array.from({ length: 60 }, (_, i) => `C:\\code\\repo${i}`);
  const { config, errors } = validateConfig({ watchedFolders: folders });
  assert.equal(config.watchedFolders.length, 50);
  assert.match(errors[0].message, /at most 50/);
});

test('app rules: invalid regexes are rejected with a message, valid rules kept', () => {
  const { config, errors } = validateConfig({
    appRules: [
      { name: 'Figma', process: '^figma$', mood: 'vibing' },
      { title: '(unclosed', mood: 'gaming' },
      { title: 'x', mood: 'sleeping' },
      { title: 'Chess', mood: 'gaming', extra: 'dropped' },
    ],
  });
  assert.deepEqual(config.appRules, [
    { name: 'Figma', process: '^figma$', mood: 'vibing' },
    { title: 'Chess', mood: 'gaming' },
  ]);
  assert.equal(errors.length, 2);
  assert.match(errors[0].message, /rule 2 title is not a valid regular expression/);
  assert.match(errors[1].message, /rule 3 mood must be one of/);
});

test('an empty rule list is allowed (no app moods)', () => {
  const { config, errors } = validateConfig({ appRules: [] });
  assert.deepEqual(config.appRules, []);
  assert.deepEqual(errors, []);
});

test('non-object input gives defaults and an error', () => {
  for (const bad of [null, 'x', 42, []]) {
    const { config, errors } = validateConfig(bad);
    assert.deepEqual(config, defaultConfig());
    assert.equal(errors[0].key, null);
  }
});

test('migration: a version 0 config (no version field) upgrades to the current version', () => {
  const v0 = { pet: 'bee', watchedFolders: ['D:\\work'], idleMinutes: 15 };
  const { config, from, errors } = migrateConfig(v0);
  assert.equal(from, 0);
  assert.deepEqual(errors, []);
  assert.equal(config.version, CONFIG_VERSION);
  assert.equal(config.pet, 'bee');
  assert.equal(v0.version, undefined, 'the input is not modified');

  const parsed = parseConfig(JSON.stringify(v0));
  assert.equal(parsed.from, 0);
  assert.equal(parsed.config.version, CONFIG_VERSION);
  assert.equal(parsed.config.idleMinutes, 15);
  assert.deepEqual(parsed.config.watchedFolders, ['D:\\work']);
  assert.equal(parsed.corrupt, false);
});

test('migration: the current version is left alone; a newer one is used with a warning', () => {
  assert.equal(migrateConfig({ version: CONFIG_VERSION, pet: 'cat' }).from, CONFIG_VERSION);
  const newer = parseConfig(JSON.stringify({ version: 99, pet: 'bat', futureThing: true }));
  assert.equal(newer.config.pet, 'bat');
  assert.equal(newer.config.version, CONFIG_VERSION);
  assert.match(newer.errors[0].message, /newer version \(99\)/);
  assert.deepEqual(newer.dropped, ['futureThing']);
  assert.equal(newer.corrupt, false);
});

test('parseConfig: corrupt JSON gives defaults and is flagged', () => {
  for (const text of ['{ not json', '', 'null', '[1,2]']) {
    const result = parseConfig(text);
    assert.deepEqual(result.config, defaultConfig(), text);
    assert.equal(result.corrupt, true, text);
    assert.ok(result.errors.length > 0);
  }
});

test('serializeConfig round-trips through parseConfig', () => {
  const config = { ...defaultConfig(), pet: 'bluepanda', watchedFolders: ['C:\\a'], bedtime: null };
  const text = serializeConfig(config);
  assert.ok(text.endsWith('\n'));
  const parsed = parseConfig(text);
  assert.deepEqual(parsed.config, config);
  assert.deepEqual(parsed.errors, []);
});

test('petForDay: same day, same pet; consecutive days always differ; all five come round', async () => {
  const { petForDay, localDateKey } = await import('../../src/core/pets.js');
  const day = (d, h = 9) => new Date(2026, 10, d, h, 0);
  assert.equal(petForDay(day(27, 0)), petForDay(day(27, 23)), 'the whole day is one pet');
  const week = [21, 22, 23, 24, 25].map((d) => petForDay(day(d)));
  assert.deepEqual([...week].sort(), [...PET_IDS].sort(), 'five days, five pets');
  for (let d = 1; d < 60; d++) assert.notEqual(petForDay(new Date(2026, 0, d)), petForDay(new Date(2026, 0, d + 1)));
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('parseConfig: a byte-order mark (saved by some Windows editors) is not corruption', () => {
  const parsed = parseConfig(`\uFEFF${JSON.stringify({ version: CONFIG_VERSION, pet: 'bee' })}`);
  assert.equal(parsed.corrupt, false);
  assert.equal(parsed.config.pet, 'bee');
  assert.deepEqual(parsed.errors, []);
});

test('the hide-or-show shortcut: Ctrl+Alt+P by default, written one standard way, or null for off', () => {
  assert.equal(defaultConfig().toggleShortcut, 'Ctrl+Alt+P');
  assert.equal(validateConfig({ toggleShortcut: 'alt+ctrl+h' }).config.toggleShortcut, 'Ctrl+Alt+H');
  const off = validateConfig({ toggleShortcut: null });
  assert.equal(off.config.toggleShortcut, null);
  assert.deepEqual(off.errors, []);
  assert.match(validateConfig({ toggleShortcut: 'Ctrl+Alt+Nope' }).errors[0].message, /doesn't know/);
});
