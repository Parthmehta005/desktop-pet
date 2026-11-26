import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  definePet, buildPetMarkup, lookFor, STATE_LOOKS, EYE_VARIANTS, MOUTH_VARIANTS,
  REQUIRED_PARTS, DEFAULT_EYES, DEFAULT_MOUTHS,
} from '../../src/renderer/rig.js';
import { ANIMATION_STATE_IDS } from '../../src/core/moods.js';
import { assertSafeMarkup } from './helpers/markup.js';

// A deliberately plain pet that exercises every rig slot.
const boxPet = () => ({
  id: 'box',
  name: 'Boxy',
  species: 'Box',
  colors: { line: '#333', ink: '#111' },
  anchors: {
    head: [100, 100], headTop: [100, 60], eyeL: [85, 100], eyeR: [115, 100],
    mouth: [100, 115], hands: [100, 165], sweat: [140, 80],
  },
  pivots: {
    rig: [100, 184], body: [100, 184], head: [100, 140], pawL: [80, 160], pawR: [120, 160],
    footL: [85, 178], footR: [115, 178], tail: [140, 160],
  },
  parts: {
    shadow: '<ellipse cx="100" cy="186" rx="40" ry="6"/>',
    tail: '<rect x="135" y="150" width="20" height="8"/>',
    footL: '<rect x="75" y="172" width="20" height="10"/>',
    footR: '<rect x="105" y="172" width="20" height="10"/>',
    body: '<rect x="60" y="120" width="80" height="60"/>',
    head: '<rect x="60" y="60" width="80" height="70"/>',
    pawL: '<rect x="70" y="160" width="16" height="12"/>',
    pawR: '<rect x="114" y="160" width="16" height="12"/>',
  },
});

test('definePet accepts a complete definition and freezes it', () => {
  const pet = definePet(boxPet());
  assert.ok(Object.isFrozen(pet));
  assert.deepEqual(pet.eyes, {});
  assert.deepEqual(pet.mouths, {});
});

test('definePet lists every problem', () => {
  const def = boxPet();
  delete def.name;
  delete def.parts.head;
  def.parts.wings = '<path/>';
  def.anchors.mouth = [1];
  delete def.pivots.rig;
  def.colors = {};
  def.eyes = { starry: () => '' };
  def.mouths = { grin: () => '' };
  assert.throws(() => definePet(def), (err) => {
    for (const bit of [
      'name is required', 'parts.head is required', 'parts.wings is not a rig part',
      'anchors.mouth must be [x, y]', 'pivots.rig must be [x, y]', 'colors.line is required',
      'eyes.starry is not an eye variant', 'mouths.grin is not a mouth variant',
    ]) assert.match(err.message, new RegExp(bit.replace(/[[\]]/g, '\\$&')));
    return true;
  });
  assert.throws(() => definePet(undefined), /Invalid pet/);
});

test('buildPetMarkup includes every part, both eyes per variant, and every mouth', () => {
  const markup = buildPetMarkup(definePet(boxPet()));
  for (const cls of ['shadow', 'flip', 'rig', 'part body', 'part head', 'part tail',
    'part foot foot-l', 'part foot foot-r', 'part paw paw-l', 'part paw paw-r', 'face',
    'props-front', 'props-fx']) {
    assert.ok(markup.includes(`class="${cls}"`), cls);
  }
  for (const v of EYE_VARIANTS) {
    const block = markup.split(`class="eyes eyes-${v}"`)[1];
    assert.ok(block, `eyes-${v}`);
  }
  assert.equal((markup.match(/class="eye"/g) ?? []).length, EYE_VARIANTS.length * 2);
  for (const v of MOUTH_VARIANTS) assert.ok(markup.includes(`class="mouth mouth-${v}"`), `mouth-${v}`);
});

test('optional parts are left out cleanly', () => {
  const def = boxPet();
  delete def.parts.tail;
  const markup = buildPetMarkup(definePet(def));
  assert.ok(!markup.includes('part tail'));
});

test('pivots become transform-origin attributes in viewBox pixels', () => {
  const markup = buildPetMarkup(definePet(boxPet()));
  assert.match(markup, /class="part paw paw-r" transform-origin="120px 160px"/);
  assert.match(markup, /class="rig" transform-origin="100px 184px"/);
});

test('pet overrides replace the default face shapes', () => {
  const def = boxPet();
  def.eyes = { open: () => '<rect class="led" width="4" height="4"/>' };
  def.mouths = { smile: () => '<rect class="led-mouth" width="8" height="2"/>' };
  const markup = buildPetMarkup(definePet(def));
  assert.equal((markup.match(/class="led"/g) ?? []).length, 2);
  assert.ok(markup.includes('class="led-mouth"'));
});

test('the rig follows its own markup rules', () => {
  assertSafeMarkup(buildPetMarkup(definePet(boxPet())), 'box pet');
  const colors = { line: '#000', ink: '#111' };
  for (const v of EYE_VARIANTS) {
    assertSafeMarkup(DEFAULT_EYES[v](-1, colors), `eye ${v}`);
  }
  for (const v of MOUTH_VARIANTS) assertSafeMarkup(DEFAULT_MOUTHS[v](colors), `mouth ${v}`);
});

test('the markup checker catches rule breaks', () => {
  assert.throws(() => assertSafeMarkup('<g style="x"></g>', 't'), /style attribute/);
  assert.throws(() => assertSafeMarkup('<g id="a"></g>', 't'), /an id/);
  assert.throws(() => assertSafeMarkup('<g class="part body" transform="translate(1 1)"></g>', 't'), /transform attribute/);
  assert.throws(() => assertSafeMarkup('<g><g></g>', 't'), /unbalanced/);
  assertSafeMarkup('<g transform="translate(1 1)"><g class="eye"></g></g>', 'static wrapper is fine');
});

test('every animation state has a look with a known face', () => {
  assert.deepEqual(Object.keys(STATE_LOOKS).sort(), [...ANIMATION_STATE_IDS].sort());
  for (const [state, look] of Object.entries(STATE_LOOKS)) {
    assert.ok(EYE_VARIANTS.includes(look.eyes), `${state}.eyes`);
    assert.ok(MOUTH_VARIANTS.includes(look.mouth) || look.mouth === 'yawn', `${state}.mouth`);
    assert.ok(Array.isArray(look.props), `${state}.props`);
  }
  assert.equal(lookFor('nope'), STATE_LOOKS.wander);
});

test('REQUIRED_PARTS are all drawn by the rig', () => {
  const markup = buildPetMarkup(definePet(boxPet()));
  for (const name of REQUIRED_PARTS) {
    assert.ok(markup.includes(boxPet().parts[name]), name);
  }
});
