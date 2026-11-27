import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MOODS, MOOD_IDS, MODIFIERS, MODIFIER_IDS, ANIMATION_STATE_IDS, APP_RULE_MOODS,
  intensityFor, presentation, animationStateFor,
} from '../../src/core/moods.js';

test('the catalogue has the 18 moods and 2 modifiers from the roadmap', () => {
  assert.deepEqual([...MOOD_IDS].sort(), [
    'alert', 'away-done', 'bedtime', 'celebrating', 'falling', 'focused', 'gaming',
    'greeting', 'happy', 'held', 'low-battery', 'petted', 'sleeping', 'stretch', 'vibing', 'wander',
    'watching', 'working',
  ]);
  assert.deepEqual([...MODIFIER_IDS].sort(), ['hidden', 'meeting']);
});

test('there are 19 animation states: every mood plus the meeting look', () => {
  assert.equal(ANIMATION_STATE_IDS.length, 19);
  assert.equal(new Set(ANIMATION_STATE_IDS).size, 19);
  assert.ok(ANIMATION_STATE_IDS.includes('meeting'));
  assert.ok(!ANIMATION_STATE_IDS.includes('hidden'));
});

test('every mood is well-formed', () => {
  for (const id of MOOD_IDS) {
    const m = MOODS[id];
    assert.equal(m.id, id);
    assert.equal(typeof m.label, 'string', `${id}.label`);
    assert.equal(typeof m.trigger, 'string', `${id}.trigger`);
    assert.ok(Number.isInteger(m.priority), `${id}.priority`);
    assert.ok(m.durationMs === null || m.durationMs > 0, `${id}.durationMs`);
    assert.ok(m.speed >= 0 && m.speed <= 1, `${id}.speed`);
    assert.ok(m.bubble === null || (typeof m.bubble === 'string' && m.bubble.length <= 12), `${id}.bubble`);
    assert.ok(Object.isFrozen(m), `${id} is frozen`);
  }
});

test('priorities are unique and follow the roadmap order', () => {
  const priorities = MOOD_IDS.map((id) => MOODS[id].priority);
  assert.equal(new Set(priorities).size, priorities.length);

  const order = [
    ['held', 'falling'],
    ['low-battery'],
    ['petted'],
    ['alert'],
    ['celebrating', 'happy'],
    ['working'],
    ['away-done'],
    ['sleeping'],
    ['greeting'],
    ['vibing', 'gaming', 'watching'],
    ['stretch', 'bedtime'],
    ['focused'],
    ['wander'],
  ];
  const flat = order.flat();
  assert.deepEqual([...flat].sort(), [...MOOD_IDS].sort(), 'order lists every mood once');
  for (let i = 0; i < flat.length - 1; i++) {
    assert.ok(
      MOODS[flat[i]].priority > MOODS[flat[i + 1]].priority,
      `${flat[i]} should outrank ${flat[i + 1]}`,
    );
  }
});

test('timed moods are exactly the transient ones', () => {
  const timed = MOOD_IDS.filter((id) => MOODS[id].durationMs !== null).sort();
  assert.deepEqual(timed, ['celebrating', 'greeting', 'happy', 'petted', 'stretch']);
});

test('only wander and bedtime walk', () => {
  const walking = MOOD_IDS.filter((id) => MOODS[id].speed > 0).sort();
  assert.deepEqual(walking, ['bedtime', 'wander']);
});

test('app rules can target the app moods and meeting mode', () => {
  for (const id of APP_RULE_MOODS) {
    assert.ok(MOODS[id] || MODIFIERS[id], id);
  }
});

test('intensityFor clamps the busy-session count to 1..3', () => {
  assert.equal(intensityFor(0), 1);
  assert.equal(intensityFor(1), 1);
  assert.equal(intensityFor(2), 2);
  assert.equal(intensityFor(3), 3);
  assert.equal(intensityFor(12), 3);
  assert.equal(intensityFor(Number.NaN), 1);
});

test('presentation applies modifiers on top of the mood', () => {
  assert.deepEqual(presentation({ mood: 'wander' }), { speed: 1, opacity: 1, showBubbles: true });
  assert.deepEqual(
    presentation({ mood: 'wander', modifiers: { meeting: true } }),
    { speed: 0, opacity: 0.5, showBubbles: false },
  );
  assert.deepEqual(
    presentation({ mood: 'bedtime', modifiers: { hidden: true } }),
    { speed: 0, opacity: 0, showBubbles: false },
  );
  assert.deepEqual(
    presentation({ mood: 'wander', modifiers: { meeting: true, hidden: true } }),
    { speed: 0, opacity: 0, showBubbles: false },
  );
  assert.equal(presentation({ mood: 'not-a-mood' }).speed, 1, 'unknown moods fall back to wander');
});

test('animationStateFor: meetings quieten everyday moods but not urgent ones', () => {
  const meeting = { meeting: true };
  for (const mood of ['wander', 'focused', 'bedtime', 'stretch', 'vibing', 'gaming', 'watching']) {
    assert.equal(animationStateFor({ mood, modifiers: meeting }), 'meeting', mood);
  }
  for (const mood of ['greeting', 'sleeping', 'away-done', 'working', 'happy', 'celebrating', 'alert', 'petted', 'held', 'falling', 'low-battery']) {
    assert.equal(animationStateFor({ mood, modifiers: meeting }), mood, mood);
  }
  assert.equal(animationStateFor({ mood: 'working' }), 'working');
  assert.equal(animationStateFor({ mood: 'wander', modifiers: { hidden: true } }), 'wander');
  assert.equal(animationStateFor({ mood: 'nope' }), 'wander');
});

test('low battery heads for the right-hand end and ignores the meeting and fullscreen modifiers', () => {
  assert.equal(MOODS['low-battery'].goesTo, 'right');
  assert.deepEqual(MOOD_IDS.filter((id) => MOODS[id].goesTo !== null), ['low-battery']);
  assert.deepEqual(MOOD_IDS.filter((id) => MOODS[id].overridesModifiers), ['low-battery']);
  const both = { meeting: true, hidden: true };
  assert.deepEqual(presentation({ mood: 'low-battery', modifiers: both }), { speed: 0, opacity: 1, showBubbles: true });
  assert.equal(animationStateFor({ mood: 'low-battery', modifiers: both }), 'low-battery');
});
