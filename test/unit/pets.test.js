import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PET_DEFINITIONS, getPet } from '../../src/renderer/pets/index.js';
import { PET_IDS, petById } from '../../src/core/pets.js';
import { buildPetMarkup } from '../../src/renderer/rig.js';
import { assertSafeMarkup } from './helpers/markup.js';

const defined = Object.values(PET_DEFINITIONS);

test('every drawn pet is in the core pet list with the same name', () => {
  assert.ok(defined.length > 0);
  for (const pet of defined) {
    assert.ok(PET_IDS.includes(pet.id), pet.id);
    assert.equal(pet.name, petById(pet.id).name);
    assert.equal(pet.species, petById(pet.id).species);
    assert.equal(PET_DEFINITIONS[pet.id], pet, 'registered under its own id');
  }
});

test('all five pets are drawn', () => {
  assert.deepEqual(Object.keys(PET_DEFINITIONS), [...PET_IDS]);
});

test('getPet falls back to Mochi', () => {
  assert.equal(getPet('cat').id, 'cat');
  assert.equal(getPet('nope').id, 'cat');
  assert.equal(getPet(undefined).id, 'cat');
});

test("every pet's markup follows the rig rules", () => {
  for (const pet of defined) assertSafeMarkup(buildPetMarkup(pet), pet.id);
});

// pets.css comes after animations.css with selectors no more specific, so a pet's own
// tail animation would also run while it sleeps or sits in a meeting unless it says not to.
test('a pet whose tail has its own animation stills it asleep and slows it in meetings', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../../src/renderer/pets/pets.css', import.meta.url), 'utf8');
  const own = [...css.matchAll(/\.pet-view\[data-pet="([\w-]+)"\] \.tail \{ animation: (?!none)[\w-]+ /g)].map((m) => m[1]);
  assert.deepEqual(own.sort(), ['bat', 'bee', 'bluepanda']);
  for (const id of own) {
    assert.match(css, new RegExp(`\\[data-pet="${id}"\\]\\[data-state="sleeping"\\] \\.tail \\{ animation: none;`), `${id} when asleep`);
    assert.match(css, new RegExp(`\\[data-pet="${id}"\\]\\[data-state="meeting"\\] \\.tail \\{ animation-duration: `), `${id} in a meeting`);
  }
});
