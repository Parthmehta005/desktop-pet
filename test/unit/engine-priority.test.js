// Reachability and pairwise priority: every mood can be reached through real events,
// and whenever two moods' conditions both hold, the higher-priority one is shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, MOOD_IDS } from '../../src/core/moods.js';
import { applicableMoods } from '../../src/core/engine.js';
import { harness, MINUTE } from './helpers/harness.js';

const idle = (seconds) => ({ type: 'idle-time', seconds });
const hhmm = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * One way to reach each mood from a fresh engine. Setups don't send prompts (a new
 * prompt deliberately ends an earlier "Done!"), and use their own session IDs, so any
 * two can be combined. `order` controls composition: 0 runs first (it moves the clock),
 * 2 runs last (it makes the user idle).
 */
const SCENARIOS = {
  wander: { setup: () => {} },
  focused: { setup: (h) => h.send({ type: 'file-activity' }) },
  bedtime: {
    // Open the bedtime window around the current time instead of moving the clock.
    setup: (h) => h.send({ type: 'config', config: { bedtime: hhmm(h.now - MINUTE), wakeTime: hhmm(h.now + 60 * MINUTE) } }),
  },
  stretch: { order: 0, setup: (h) => h.send(idle(0)).advance(90 * MINUTE) },
  watching: { setup: (h) => h.send({ type: 'app', process: 'vlc', title: 'movie.mkv' }) },
  gaming: { setup: (h) => h.send({ type: 'app', process: 'javaw', title: 'Minecraft' }) },
  vibing: { setup: (h) => h.send({ type: 'app', process: 'Spotify' }) },
  greeting: { setup: (h) => h.send({ type: 'app-start' }) },
  sleeping: { order: 2, setup: (h) => h.send(idle(3600)) },
  'away-done': { order: 2, setup: (h) => h.send(idle(3600)).claude('Stop', 'sc-away') },
  working: { setup: (h) => h.claude('PreToolUse', 'sc-working') },
  happy: { setup: (h) => h.claude('Stop', 'sc-happy') },
  celebrating: { setup: (h) => h.send({ type: 'commit' }) },
  alert: { setup: (h) => h.claude('PreToolUse', 'sc-alert').permission('sc-alert') },
  petted: { setup: (h) => h.send({ type: 'pet' }) },
  falling: { setup: (h) => h.send({ type: 'grab' }).send({ type: 'drop' }) },
  held: { setup: (h) => h.send({ type: 'grab' }) },
  'low-battery': { setup: (h) => h.send({ type: 'battery', percent: 8, charging: false, present: true }) },
};

/** Pairs that can never hold at the same time, and why. */
const EXCLUSIVE = [
  ['held', 'falling', 'the pet is either in your hand or falling'],
  ['vibing', 'gaming', 'one foreground window'],
  ['vibing', 'watching', 'one foreground window'],
  ['gaming', 'watching', 'one foreground window'],
];

/**
 * Pairs where setting up the higher mood switches the lower one off, which is the
 * point: being idle ends the bedtime nudge. The higher mood must still win.
 */
const SUPPRESSED = [
  ['sleeping', 'bedtime', 'bedtime only nags while you are active'],
  ['away-done', 'bedtime', 'bedtime only nags while you are active'],
];

const key = (a, b) => [a, b].sort().join('+');
const exclusive = new Set(EXCLUSIVE.map(([a, b]) => key(a, b)));
const suppressed = new Set(SUPPRESSED.map(([a, b]) => key(a, b)));

function compose(...ids) {
  const h = harness();
  const ordered = [...ids].sort((a, b) => (SCENARIOS[a].order ?? 1) - (SCENARIOS[b].order ?? 1));
  for (const id of ordered) SCENARIOS[id].setup(h);
  return h;
}

test('every mood has a scenario', () => {
  assert.deepEqual(Object.keys(SCENARIOS).sort(), [...MOOD_IDS].sort());
});

for (const id of MOOD_IDS) {
  test(`reachable: ${id}`, () => {
    assert.equal(compose(id).mood(), id);
  });
}

test('reachable: meeting modifier', () => {
  const h = harness().send({ type: 'app', process: 'Zoom', title: 'Zoom Meeting' });
  assert.equal(h.result().modifiers.meeting, true);
});

test('reachable: hidden modifier', () => {
  const h = harness().send({ type: 'app', process: 'game', title: 'Game', fullscreen: true });
  assert.equal(h.result().modifiers.hidden, true);
});

for (let i = 0; i < MOOD_IDS.length; i++) {
  for (let j = i + 1; j < MOOD_IDS.length; j++) {
    const [a, b] = [MOOD_IDS[i], MOOD_IDS[j]];
    if (exclusive.has(key(a, b))) continue;
    const [high, low] = MOODS[a].priority > MOODS[b].priority ? [a, b] : [b, a];
    test(`priority: ${high} beats ${low}`, () => {
      const h = compose(a, b);
      const applicable = applicableMoods(h.state, h.now);
      assert.ok(applicable.includes(high), `${high} should apply (got ${applicable})`);
      if (!suppressed.has(key(a, b))) {
        assert.ok(applicable.includes(low), `${low} should also apply (got ${applicable})`);
      }
      assert.equal(h.mood(), high);
    });
  }
}

test('exclusive pairs really are exclusive: the later one replaces the earlier', () => {
  for (const [a, b] of EXCLUSIVE) {
    const h = harness();
    SCENARIOS[a].setup(h);
    SCENARIOS[b].setup(h);
    const applicable = applicableMoods(h.state, h.now);
    assert.ok(!(applicable.includes(a) && applicable.includes(b)), `${a} and ${b} together`);
  }
});

test('suppressed pairs really suppress the lower mood', () => {
  for (const [high, low] of SUPPRESSED) {
    const h = compose(high, low);
    const applicable = applicableMoods(h.state, h.now);
    assert.ok(!applicable.includes(low), `${low} should be off under ${high}`);
  }
});
