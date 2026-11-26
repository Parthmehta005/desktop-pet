// Every pet's drawing, by id. The list of ids and names lives in src/core/pets.js.
import cat from './cat.js';

export const PET_DEFINITIONS = Object.freeze({ cat });

/** The pet with this id, or Mochi if there's no such pet. */
export function getPet(id) {
  return PET_DEFINITIONS[id] ?? PET_DEFINITIONS.cat;
}
