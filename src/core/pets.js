/**
 * The pets you can choose from. This is just the list; each pet's drawing lives in
 * src/renderer/pets/<id>.js. All pets are original designs.
 */
export const PETS = Object.freeze([
  { id: 'cat', name: 'Mochi', species: 'Cat' },
  { id: 'corgi', name: 'Biscuit', species: 'Corgi' },
  { id: 'penguin', name: 'Pip', species: 'Penguin' },
  { id: 'axolotl', name: 'Axo', species: 'Axolotl' },
  { id: 'robot', name: 'Bolt', species: 'Robot' },
  { id: 'softbot', name: 'Nimbus', species: 'Soft care-bot' },
].map((pet) => Object.freeze(pet)));

export const PET_IDS = Object.freeze(PETS.map((p) => p.id));

export function petById(id) {
  return PETS.find((p) => p.id === id) ?? null;
}
