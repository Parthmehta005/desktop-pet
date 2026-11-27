import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWalker, stepWalker, resizeWalker, placeWalker, BASE_SPEED, MAX_STEP_MS,
} from '../../src/core/walker.js';
import { seededRandom } from '../../src/core/random.js';
import { presentation } from '../../src/core/moods.js';

const inBounds = (w) => w.x >= 0 && w.x <= Math.max(0, w.width - w.petWidth);

/** Forces the walk phase with plenty of time left so tests can measure movement. */
const walking = (w, facing = w.facing) => Object.freeze({ ...w, phase: 'walk', phaseLeftMs: 1e9, facing });

test('seededRandom is deterministic and in [0, 1)', () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(seededRandom(1)(), seededRandom(2)());
});

test('createWalker starts inside the strip', () => {
  const rng = seededRandom(1);
  for (let i = 0; i < 100; i++) {
    const w = createWalker({ width: 800, petWidth: 120, rng });
    assert.ok(inBounds(w));
  }
  assert.equal(createWalker({ width: 800, petWidth: 120, x: 5000 }).x, 680);
  assert.equal(createWalker({ width: 800, petWidth: 120, x: -50 }).x, 0);
  assert.equal(createWalker({ width: 100, petWidth: 120, x: 30 }).x, 0, 'a strip narrower than the pet pins it at 0');
});

test('never leaves the strip across 10,000 random steps, moods and resizes', () => {
  const rng = seededRandom(20261126);
  const moods = ['wander', 'bedtime', 'working', 'sleeping'];
  let w = createWalker({ width: 1280, petWidth: 120, rng });
  for (let i = 0; i < 10_000; i++) {
    if (i % 500 === 0) w = resizeWalker(w, Math.floor(rng() * 3800) + 50);
    const mood = moods[Math.floor(rng() * moods.length)];
    w = stepWalker(w, {
      dtMs: rng() * 1500,
      speed: presentation({ mood }).speed,
      walkSpeed: 0.25 + rng() * 2.75,
      rng,
    });
    assert.ok(inBounds(w), `step ${i}: x=${w.x} width=${w.width}`);
  }
});

test('walks at BASE_SPEED x mood speed x walkSpeed', () => {
  const w = walking(createWalker({ width: 2000, petWidth: 100, x: 500, facing: 1 }));
  assert.equal(stepWalker(w, { dtMs: 1000, speed: 1, walkSpeed: 1 }).x, 500 + BASE_SPEED);
  assert.equal(stepWalker(w, { dtMs: 1000, speed: 0.5, walkSpeed: 1 }).x, 500 + BASE_SPEED / 2);
  assert.equal(stepWalker(w, { dtMs: 500, speed: 1, walkSpeed: 2 }).x, 500 + BASE_SPEED);
  assert.equal(stepWalker(walking(w, -1), { dtMs: 1000 }).x, 500 - BASE_SPEED);
});

test('a long stalled frame is capped at MAX_STEP_MS', () => {
  const w = walking(createWalker({ width: 5000, petWidth: 100, x: 1000, facing: 1 }));
  assert.equal(stepWalker(w, { dtMs: 60_000 }).x, 1000 + BASE_SPEED * (MAX_STEP_MS / 1000));
});

test('turns around at both edges', () => {
  let w = walking(createWalker({ width: 400, petWidth: 100, x: 290, facing: 1 }));
  w = stepWalker(w, { dtMs: 1000 });
  assert.equal(w.x, 300);
  assert.equal(w.facing, -1);
  w = walking(createWalker({ width: 400, petWidth: 100, x: 10, facing: -1 }));
  w = stepWalker(w, { dtMs: 1000 });
  assert.equal(w.x, 0);
  assert.equal(w.facing, 1);
});

test('does not move in moods and modifiers that keep it still', () => {
  const rng = seededRandom(7);
  const still = [
    { mood: 'sleeping' },
    { mood: 'held' },
    { mood: 'away-done' },
    { mood: 'working' },
    { mood: 'wander', modifiers: { meeting: true } },
    { mood: 'wander', modifiers: { hidden: true } },
  ];
  for (const result of still) {
    let w = walking(createWalker({ width: 1000, petWidth: 100, x: 400 }));
    for (let i = 0; i < 200; i++) w = stepWalker(w, { dtMs: 100, speed: presentation(result).speed, rng });
    assert.equal(w.x, 400, JSON.stringify(result));
    assert.equal(w.moving, false);
  }
});

test('a still pet keeps its phase and resumes from it', () => {
  let w = walking(createWalker({ width: 1000, petWidth: 100, x: 400 }));
  w = stepWalker(w, { dtMs: 100, speed: 1 });
  assert.equal(w.moving, true);
  const frozen = stepWalker(w, { dtMs: 5000, speed: 0 });
  assert.equal(frozen.phaseLeftMs, w.phaseLeftMs);
  assert.equal(frozen.moving, false);
  assert.equal(stepWalker(frozen, { dtMs: 0, speed: 0 }), frozen, 'no change, same object');
});

test('cycles through walk, pause and sit, and sometimes turns', () => {
  const rng = seededRandom(3);
  let w = createWalker({ width: 100_000, petWidth: 100, x: 50_000, rng });
  const phases = new Set();
  let turns = 0;
  for (let i = 0; i < 5000; i++) {
    const before = w.facing;
    w = stepWalker(w, { dtMs: 100, rng });
    phases.add(w.phase);
    if (w.facing !== before) turns++;
    if (w.phase !== 'walk') assert.equal(w.moving, false);
  }
  assert.deepEqual([...phases].sort(), ['pause', 'sit', 'walk']);
  assert.ok(turns > 0);
});

test('the same seed gives the same walk', () => {
  const run = () => {
    const rng = seededRandom(99);
    let w = createWalker({ width: 1920, petWidth: 128, rng });
    for (let i = 0; i < 1000; i++) w = stepWalker(w, { dtMs: 16, rng });
    return w;
  };
  assert.deepEqual(run(), run());
});

test('resizing mid-walk clamps the position', () => {
  let w = walking(createWalker({ width: 1920, petWidth: 120, x: 1700 }));
  w = resizeWalker(w, 800);
  assert.equal(w.x, 680);
  assert.equal(w.width, 800);
  w = resizeWalker(w, 800, 200);
  assert.equal(w.x, 600, 'a bigger pet also clamps');
  w = resizeWalker(w, Number.NaN);
  assert.equal(w.width, 800, 'nonsense sizes are ignored');
});

test('placeWalker drops the pet inside the strip', () => {
  const w = createWalker({ width: 1000, petWidth: 100, x: 0 });
  assert.equal(placeWalker(w, 450).x, 450);
  assert.equal(placeWalker(w, 5000).x, 900);
  assert.equal(placeWalker(w, -20).x, 0);
  assert.equal(placeWalker(w, Number.NaN).x, 0);
});

test('nonsense step input does not move the pet or break it', () => {
  const w = walking(createWalker({ width: 1000, petWidth: 100, x: 300 }));
  for (const opts of [{ dtMs: -5 }, { dtMs: Number.NaN }, { dtMs: 100, speed: -1 }, { dtMs: 100, walkSpeed: Number.NaN }]) {
    const next = stepWalker(w, opts);
    assert.equal(next.x, 300, JSON.stringify(opts));
  }
});

test('goTo right: runs to the right-hand end at running speed, faces right and stays', async () => {
  const { RUN_FACTOR, BASE_SPEED } = await import('../../src/core/walker.js');
  let w = createWalker({ width: 1000, petWidth: 100, x: 500, facing: -1, rng: () => 0.5 });
  w = stepWalker(w, { dtMs: 1000, speed: 0, goTo: 'right' });
  assert.equal(w.x, 500 + BASE_SPEED * RUN_FACTOR, 'runs even though the mood itself keeps still');
  assert.equal(w.facing, 1);
  assert.equal(w.moving, true);
  for (let i = 0; i < 10; i++) w = stepWalker(w, { dtMs: 1000, speed: 0, goTo: 'right' });
  assert.equal(w.x, 900, 'stops at the end');
  assert.equal(w.moving, false);
  assert.equal(w.facing, 1);
  const again = stepWalker(w, { dtMs: 1000, speed: 0, goTo: 'right' });
  assert.equal(again, w, 'standing there changes nothing');
});

test('goTo respects the walking-speed setting, and walking resumes where it left off', () => {
  const start = createWalker({ width: 1000, petWidth: 100, x: 0, rng: () => 0.5 });
  const slow = stepWalker(start, { dtMs: 1000, walkSpeed: 0.5, goTo: 'right' });
  const fast = stepWalker(start, { dtMs: 1000, walkSpeed: 2, goTo: 'right' });
  assert.ok(fast.x > slow.x);
  assert.equal(slow.phase, start.phase, 'the wander phase is kept for later');
  const left = stepWalker(fast, { dtMs: 1000, goTo: 'left' });
  assert.equal(left.facing, -1);
  assert.ok(left.x < fast.x);
});
