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

test('getPet falls back to Mochi', () => {
  assert.equal(getPet('cat').id, 'cat');
  assert.equal(getPet('nope').id, 'cat');
  assert.equal(getPet(undefined).id, 'cat');
});

test("every pet's markup follows the rig rules", () => {
  for (const pet of defined) assertSafeMarkup(buildPetMarkup(pet), pet.id);
});
