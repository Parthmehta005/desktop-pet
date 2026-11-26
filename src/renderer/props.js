/**
 * Props the pet can show: things it holds, wears, or that float around it.
 *
 * Each prop has a `layer` (where the rig places it) and a `render(pet)` function that
 * draws it using the pet's anchors, so the same laptop or nightcap fits every pet.
 *   head   moves with the head (headphones, nightcap, sweat, zzz...)
 *   front  in front of the body, behind the paws (laptop, controller, popcorn, flag)
 *   fx     effects around the whole pet, not flipped or bobbed (confetti, sparkles...)
 *
 * Filled in over M2.
 */

export const PROPS = Object.freeze({});

export const PROP_NAMES = Object.freeze(Object.keys(PROPS));
