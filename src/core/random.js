/**
 * Small seeded random number generator (mulberry32) so walking can be replayed exactly
 * in tests. Returns a function that yields numbers in [0, 1), like Math.random.
 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [min, max) from `rng`. */
export function between(rng, min, max) {
  return min + (max - min) * rng();
}
