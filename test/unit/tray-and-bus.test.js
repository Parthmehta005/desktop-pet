import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../../src/main/event-bus.js';
import { buildTrayMenu, TEST_REACTIONS } from '../../src/main/tray-menu.js';
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
  bus.setPaused(true);
  assert.deepEqual(delivered, ['commit', 'reset', 'pet'], 'pausing twice sends one reset');
  bus.setPaused(false);
  bus.emit({ type: 'commit' });
  assert.deepEqual(delivered, ['commit', 'reset', 'pet', 'commit']);
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
    quit: () => calls.push(['quit']),
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
  byLabel['Quit Desktop Pet'].click();

  assert.deepEqual(calls, [['setPet', 'penguin'], ['setPaused', true], ['test', 'claude-working'], ['quit']]);
  assert.equal(buildTrayMenu({ config: { pet: 'cat' }, paused: true, pets: PETS }, actions)
    .find((m) => m.label === 'Pause reactions').checked, true);
});
