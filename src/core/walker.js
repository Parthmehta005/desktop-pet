/**
 * Where the pet is along the strip and what its legs are doing.
 *
 * The walker alternates between three phases while the mood lets it move:
 *   walk   moves left or right at the current speed, turning round at the edges
 *   pause  stands still for a moment, then maybe turns round
 *   sit    sits down for a while
 * Moods that keep the pet still (speed 0) freeze the walker where it is; it carries on
 * from the same phase when the pet is allowed to move again.
 *
 * A mood can instead send the pet to one end of the strip (`goTo: 'right'`, for low
 * battery): it runs there at RUN_FACTOR times walking speed and stays, facing that way.
 *
 * All functions are pure and return a new walker. Randomness comes from the `rng`
 * argument so tests can use a seeded generator.
 */

import { between } from './random.js';

/** Pixels per second at walkSpeed 1 and mood speed 1. */
export const BASE_SPEED = 60;
/** Longest time step applied at once, so a stalled frame can't teleport the pet. */
export const MAX_STEP_MS = 1000;
/** How much faster than walking the pet runs when a mood sends it somewhere. */
export const RUN_FACTOR = 3;

const PHASE_MS = {
  walk: [2000, 6000],
  pause: [800, 2500],
  sit: [3000, 7000],
};
const SIT_CHANCE = 0.3;
const TURN_CHANCE = 0.3;

function maxX(width, petWidth) {
  return Math.max(0, width - petWidth);
}

function clamp(x, width, petWidth) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(Math.max(x, 0), maxX(width, petWidth));
}

function sane(n, fallback) {
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * @param {{ width: number, petWidth: number, x?: number, facing?: 1 | -1, rng?: () => number }} options
 */
export function createWalker({ width, petWidth, x, facing = 1, rng = Math.random }) {
  const w = sane(width, 0);
  const pw = sane(petWidth, 0);
  return Object.freeze({
    width: w,
    petWidth: pw,
    x: clamp(x ?? between(rng, 0, maxX(w, pw)), w, pw),
    facing: facing === -1 ? -1 : 1,
    phase: 'walk',
    phaseLeftMs: between(rng, ...PHASE_MS.walk),
    moving: false,
  });
}

function nextPhase(walker, rng) {
  if (walker.phase === 'walk') {
    const phase = rng() < SIT_CHANCE ? 'sit' : 'pause';
    return { phase, phaseLeftMs: between(rng, ...PHASE_MS[phase]), facing: walker.facing };
  }
  const facing = rng() < TURN_CHANCE ? -walker.facing : walker.facing;
  return { phase: 'walk', phaseLeftMs: between(rng, ...PHASE_MS.walk), facing };
}

/**
 * Advances the walker by `dtMs`.
 *
 * @param {object} walker
 * @param {{ dtMs: number, speed?: number, walkSpeed?: number, goTo?: 'right' | 'left' | null, rng?: () => number }} options
 *   `speed` is the mood's speed after modifiers (see `presentation()` in moods.js);
 *   `walkSpeed` is the user's setting; `goTo` sends the pet to that end of the strip.
 */
export function stepWalker(walker, { dtMs, speed = 1, walkSpeed = 1, goTo = null, rng = Math.random }) {
  const dt = Math.min(sane(dtMs, 0), MAX_STEP_MS);
  if (goTo === 'right' || goTo === 'left') return runToEnd(walker, goTo, dt, walkSpeed);
  const factor = sane(speed, 0) * sane(walkSpeed, 0);
  if (dt === 0 || factor === 0) {
    return walker.moving ? Object.freeze({ ...walker, moving: false }) : walker;
  }

  let { x, facing, phase, phaseLeftMs } = walker;
  phaseLeftMs -= dt;
  if (phaseLeftMs <= 0) ({ phase, phaseLeftMs, facing } = nextPhase({ phase, facing }, rng));

  let moving = false;
  if (phase === 'walk') {
    const limit = maxX(walker.width, walker.petWidth);
    x += facing * BASE_SPEED * factor * (dt / 1000);
    if (x <= 0) {
      x = 0;
      facing = 1;
    } else if (x >= limit) {
      x = limit;
      facing = -1;
    }
    moving = limit > 0;
  }
  return Object.freeze({ ...walker, x, facing, phase, phaseLeftMs, moving });
}

function runToEnd(walker, end, dt, walkSpeed) {
  const facing = end === 'right' ? 1 : -1;
  const target = end === 'right' ? maxX(walker.width, walker.petWidth) : 0;
  const step = BASE_SPEED * RUN_FACTOR * Math.max(sane(walkSpeed, 1), 0.25) * (dt / 1000);
  const x = facing === 1 ? Math.min(walker.x + step, target) : Math.max(walker.x - step, target);
  const moving = x !== target;
  if (x === walker.x && facing === walker.facing && moving === walker.moving) return walker;
  return Object.freeze({ ...walker, x, facing, moving });
}

/** The strip (or the pet) changed size: keep the pet inside it. */
export function resizeWalker(walker, width, petWidth = walker.petWidth) {
  const w = sane(width, walker.width);
  const pw = sane(petWidth, walker.petWidth);
  return Object.freeze({ ...walker, width: w, petWidth: pw, x: clamp(walker.x, w, pw) });
}

/** Puts the pet at `x` (e.g. where it was dropped), kept inside the strip. */
export function placeWalker(walker, x) {
  return Object.freeze({ ...walker, x: clamp(x, walker.width, walker.petWidth) });
}
