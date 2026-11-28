// Every pet's drawing, by id. The list of ids and names lives in src/core/pets.js.
import cat from './cat.js';
import penguin from './penguin.js';
import bluepanda from './bluepanda.js';
import bee from './bee.js';
import bat from './bat.js';

export const PET_DEFINITIONS = Object.freeze({ cat, penguin, bluepanda, bee, bat });

/** The pet with this id, or Mochi if there's no such pet. */
export function getPet(id) {
  return PET_DEFINITIONS[id] ?? PET_DEFINITIONS.cat;
}
