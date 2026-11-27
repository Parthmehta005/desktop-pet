import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../../src/main/event-bus.js';
import { buildTrayMenu, hooksStatusLabel, TEST_REACTIONS } from '../../src/main/tray-menu.js';
import { PETS } from '../../src/core/pets.js';
import { createEngine } from '../../src/core/engine.js';

test('the event bus delivers events until paused; test reactions always get through', () => {
  const delivered = [];
  const bus = createEventBus((e) => delivered.push(e.type));
  assert.equal(bus.emit({ type: 'commit' }, { source: 'git' }), true);
  bus.setPaused(true);
  assert.deepEqual(delivered, ['commit', 'reset'], 'pausing calms the pet with a reset');
  assert.equal(bus.emit({ type: 'commit' }, { source: 'git' }), false);
  assert.equal(bus.emit({ type: 'pet' }, { source: 'test' }), true);
  assert.equal(bus.emit({ type: 'battery', percent: 5 }, { source: 'battery' }), true, 'a low battery beats a pause');
  bus.setPaused(true);
  assert.deepEqual(delivered, ['commit', 'reset', 'pet', 'battery'], 'pausing twice sends one reset');
  bus.setPaused(false);
  bus.emit({ type: 'commit' });
  assert.deepEqual(delivered, ['commit', 'reset', 'pet', 'battery', 'commit']);
  assert.equal(bus.paused, false);
});

const T = new Date(2026, 10, 26, 14, 0).getTime();
const EXPECTED = {
  'claude-working': 'working',
  'claude-needs-you': 'alert',
  'claude-done': 'happy',
  'file-edit': 'focused',
  commit: 'celebrating',
  sleep: 'sleeping',
  music: 'vibing',
  game: 'gaming',
  video: 'watching',
  'back-to-work': 'wander',
  pet: 'petted',
};

test('each test reaction produces the mood its label promises', () => {
  for (const r of TEST_REACTIONS) {
    const engine = createEngine();
    let result;
    for (const e of r.events) result = engine.dispatch(e, T);
    if (r.id === 'meeting') assert.equal(result.modifiers.meeting, true, r.id);
    else if (r.id === 'fullscreen') assert.equal(result.modifiers.hidden, true, r.id);
    else if (r.id === 'wake') assert.equal(result.mood, 'wander', r.id);
    else assert.equal(result.mood, EXPECTED[r.id], r.id);
  }
  assert.equal(new Set(TEST_REACTIONS.map((r) => r.id)).size, TEST_REACTIONS.length);
});

test('the tray menu: pet radio list, pause checkbox, test reactions, quit', () => {
  const calls = [];
  const actions = {
    setPet: (id) => calls.push(['setPet', id]),
    setPaused: (p) => calls.push(['setPaused', p]),
    test: (id) => calls.push(['test', id]),
    installHooks: () => calls.push(['installHooks']),
    uninstallHooks: () => calls.push(['uninstallHooks']),
    openSettings: () => calls.push(['openSettings']),
    quit: () => calls.push(['quit']),
    toggleHidden: () => calls.push(['toggleHidden']),
  };
  const menu = buildTrayMenu({ config: { pet: 'corgi' }, paused: false, pets: PETS }, actions);
  const byLabel = Object.fromEntries(menu.filter((m) => m.label).map((m) => [m.label, m]));

  const pets = byLabel.Pet.submenu;
  assert.deepEqual(pets.map((p) => p.label), PETS.map((p) => `${p.name} (${p.species})`));
  assert.deepEqual(pets.filter((p) => p.checked).map((p) => p.label), ['Biscuit (Corgi)']);
  assert.ok(pets.every((p) => p.type === 'radio'));
  pets[2].click();

  assert.equal(byLabel['Pause reactions'].type, 'checkbox');
  assert.equal(byLabel['Pause reactions'].checked, false);
  byLabel['Pause reactions'].click();

  assert.equal(byLabel['Test reactions'].submenu.length, TEST_REACTIONS.length);
  byLabel['Test reactions'].submenu[0].click();
  byLabel['Install Claude Code hooks'].click();
  byLabel['Remove Claude Code hooks'].click();
  byLabel['Settings...'].click();
  byLabel['Quit Desktop Pet'].click();
  byLabel['Hide pet'].click();

  assert.deepEqual(calls, [
    ['setPet', 'penguin'], ['setPaused', true], ['test', 'claude-working'],
    ['installHooks'], ['uninstallHooks'], ['openSettings'], ['quit'], ['toggleHidden'],
  ]);
  assert.equal(menu[0].label, 'Desktop Pet', 'no version given, just the name');
  assert.equal(buildTrayMenu({ config: { pet: 'cat' }, paused: false, pets: PETS, version: '1.2.3' }, actions)[0].label,
    'Desktop Pet 1.2.3', 'the version shows at the top');
  const hiddenMenu = buildTrayMenu({ config: { pet: 'cat' }, paused: false, pets: PETS, hidden: true }, actions);
  assert.equal(hiddenMenu[1].label, 'Show pet', 'the item says what it will do');
  assert.equal(hiddenMenu[1].accelerator, undefined, 'no shortcut, no hint');
  const withShortcut = buildTrayMenu({ config: { pet: 'cat' }, paused: false, pets: PETS, shortcut: 'Ctrl+Alt+P' }, actions)[1];
  assert.equal(withShortcut.accelerator, 'Ctrl+Alt+P', 'the shortcut is shown as a reminder');
  assert.equal(withShortcut.registerAccelerator, false, 'but the menu does not grab it');
  assert.equal(buildTrayMenu({ config: { pet: 'cat' }, paused: true, pets: PETS }, actions)
    .find((m) => m.label === 'Pause reactions').checked, true);
});

test('the Claude Code part of the tray follows the hook status', () => {
  const menu = (hooks) => {
    const items = buildTrayMenu({ config: { pet: 'cat' }, paused: false, pets: PETS, hooks }, {});
    const by = (label) => items.find((m) => m.label === label);
    return { status: items[3].label, install: by('Install Claude Code hooks').enabled, remove: by('Remove Claude Code hooks').enabled };
  };
  assert.deepEqual(menu({ status: 'not-installed', serverError: null }), { status: 'Claude Code: hooks not installed', install: true, remove: false });
  assert.deepEqual(menu({ status: 'installed', serverError: null }), { status: 'Claude Code: connected', install: false, remove: true });
  assert.deepEqual(menu({ status: 'outdated', serverError: null }), { status: 'Claude Code: hooks out of date', install: true, remove: true });
  assert.deepEqual(menu({ status: 'invalid-settings', serverError: null }), { status: "Claude Code: can't read its settings.json", install: false, remove: false });
  assert.match(hooksStatusLabel({ status: 'installed', serverError: 'Port in use' }), /can't listen/);
});
