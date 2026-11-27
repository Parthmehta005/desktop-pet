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

/** "2026-11-27" for the local date of `date`. */
export function localDateKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * The pet for "a different pet every day": a rotation through all the pets by local
 * calendar day, so the same day always gives the same pet (restarts don't reshuffle) and
 * two days in a row never give the same one.
 */
export function petForDay(date) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return PET_IDS[((day % PET_IDS.length) + PET_IDS.length) % PET_IDS.length];
}
