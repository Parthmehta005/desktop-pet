import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROPS, PROP_NAMES } from '../../src/renderer/props.js';
import { STATE_LOOKS } from '../../src/renderer/rig.js';
import { PET_DEFINITIONS } from '../../src/renderer/pets/index.js';
import { assertSafeMarkup } from './helpers/markup.js';

test('the 17 props exist, each on a known layer', () => {
  assert.deepEqual([...PROP_NAMES].sort(), [
    'battery', 'confetti', 'controller', 'exclaim', 'flag', 'headphones', 'hearts', 'laptop', 'muted',
    'nightcap', 'notes', 'popcorn', 'sparkles', 'speedlines', 'steam', 'sweat', 'zzz',
  ]);
  for (const name of PROP_NAMES) assert.ok(['head', 'front', 'fx'].includes(PROPS[name].layer), name);
});

test('every prop a state asks for exists, and every prop is used', () => {
  const used = new Set();
  for (const [state, look] of Object.entries(STATE_LOOKS)) {
    for (const prop of look.props) {
      assert.ok(PROP_NAMES.includes(prop), `${state} uses unknown prop ${prop}`);
      used.add(prop);
    }
  }
  assert.deepEqual([...used].sort(), [...PROP_NAMES].sort());
});

test('props render safely for every pet', () => {
  for (const pet of Object.values(PET_DEFINITIONS)) {
    for (const name of PROP_NAMES) assertSafeMarkup(PROPS[name].render(pet), `${pet.id} ${name}`);
  }
});

test('sweat has three drops for the three intensity levels', () => {
  const markup = PROPS.sweat.render(PET_DEFINITIONS.cat);
  for (const n of [1, 2, 3]) assert.ok(markup.includes(`class="drop drop-${n}"`), `drop-${n}`);
});
