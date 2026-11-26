import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeOfDay, inTimeWindow } from '../../src/core/time.js';
import { harness, SECOND, MINUTE } from './helpers/harness.js';

const idle = (seconds) => ({ type: 'idle-time', seconds });
const at = (h, m) => new Date(2026, 10, 27, h, m, 0).getTime();

test('parseTimeOfDay', () => {
  assert.equal(parseTimeOfDay('00:00'), 0);
  assert.equal(parseTimeOfDay('00:30'), 30);
  assert.equal(parseTimeOfDay('23:59'), 23 * 60 + 59);
  for (const bad of ['24:00', '7:30', '12:60', '', null, 1230, '12:30pm']) {
    assert.equal(parseTimeOfDay(bad), null, String(bad));
  }
});

test('inTimeWindow handles windows that wrap past midnight', () => {
  assert.ok(inTimeWindow(at(0, 30), '00:30', '06:00'));
  assert.ok(inTimeWindow(at(5, 59), '00:30', '06:00'));
  assert.ok(!inTimeWindow(at(6, 0), '00:30', '06:00'), 'end is exclusive');
  assert.ok(!inTimeWindow(at(0, 29), '00:30', '06:00'));
  assert.ok(inTimeWindow(at(23, 15), '23:00', '06:00'));
  assert.ok(inTimeWindow(at(2, 0), '23:00', '06:00'));
  assert.ok(!inTimeWindow(at(12, 0), '23:00', '06:00'));
  assert.ok(!inTimeWindow(at(1, 0), null, '06:00'), 'null turns it off');
  assert.ok(!inTimeWindow(at(1, 0), '01:00', '01:00'), 'equal times turn it off');
});

test('bedtime shows while you are active in the window, and not while asleep', () => {
  const h = harness({}, at(0, 45));
  assert.equal(h.mood(), 'bedtime');
  h.send(idle(600));
  assert.equal(h.mood(), 'sleeping');
  h.send(idle(0)).advance(3 * SECOND);
  assert.equal(h.mood(), 'bedtime');
});

test('bedtime ends at wake time', () => {
  const h = harness({}, at(5, 59));
  assert.equal(h.mood(), 'bedtime');
  h.advance(MINUTE);
  assert.equal(h.mood(), 'wander');
});

test('bedtime is configurable and can be turned off', () => {
  assert.equal(harness({ bedtime: '22:00', wakeTime: '07:00' }, at(22, 30)).mood(), 'bedtime');
  assert.equal(harness({ bedtime: null }, at(1, 0)).mood(), 'wander');
});

test('bedtime is a low-priority mood: Claude and apps still show', () => {
  const h = harness({}, at(1, 0));
  h.send({ type: 'app', process: 'Spotify' });
  assert.equal(h.mood(), 'vibing');
  h.claude('UserPromptSubmit');
  assert.equal(h.mood(), 'working');
});

test('90 active minutes without a break triggers a 12s stretch, then repeats', () => {
  const h = harness();
  h.send({ type: 'app-start' }).advance(3 * SECOND);
  h.advance(90 * MINUTE - 3 * SECOND - 1);
  assert.equal(h.mood(), 'wander');
  h.advance(1);
  assert.equal(h.mood(), 'stretch');
  h.advance(12 * SECOND);
  assert.equal(h.mood(), 'wander');
  h.advance(90 * MINUTE - 12 * SECOND);
  assert.equal(h.mood(), 'stretch', 'another reminder if you still have not taken a break');
});

test('a 5-minute break resets the stretch timer', () => {
  const h = harness();
  h.send({ type: 'app-start' });
  h.advance(80 * MINUTE).send(idle(5 * 60)); // a real break
  h.send(idle(0)).advance(20 * MINUTE);
  assert.notEqual(h.mood(), 'stretch', '80 + 20 minutes is not 90 in a row');
  h.advance(70 * MINUTE);
  assert.equal(h.mood(), 'stretch');
});

test('short pauses do not count as a break', () => {
  const h = harness();
  h.send({ type: 'app-start' });
  for (let i = 0; i < 9; i++) h.advance(10 * MINUTE).send(idle(60));
  assert.equal(h.mood(), 'stretch');
});

test('no stretch reminder while you are idle or locked', () => {
  const h = harness({ idleMinutes: 10, breakMinutes: 30 });
  h.send({ type: 'app-start' }).advance(89 * MINUTE).send(idle(11 * 60)).advance(2 * MINUTE);
  assert.equal(h.mood(), 'sleeping');
  h.send({ type: 'lock' }).advance(3 * 60 * MINUTE);
  assert.equal(h.mood(), 'sleeping');
  h.send({ type: 'unlock' }).advance(3 * SECOND);
  assert.equal(h.mood(), 'wander', 'unlocking starts a fresh streak');
});

test('the stretch reminder can be turned off or retimed', () => {
  const off = harness({ breakReminderMinutes: 0 });
  off.send({ type: 'app-start' }).advance(10 * 60 * MINUTE);
  assert.equal(off.mood(), 'wander');

  const h = harness();
  h.send({ type: 'app-start' }).send({ type: 'config', config: { breakReminderMinutes: 30 } });
  h.advance(30 * MINUTE);
  assert.equal(h.mood(), 'stretch');
});

test('clicking the pet makes it happy-petted for 2s', () => {
  const h = harness();
  h.send({ type: 'pet' });
  assert.equal(h.mood(), 'petted');
  h.advance(2 * SECOND);
  assert.equal(h.mood(), 'wander');
});

test('grab, drop, land: held, falling, then back to whatever it was doing', () => {
  const h = harness();
  h.claude('UserPromptSubmit');
  h.send({ type: 'grab' });
  assert.equal(h.mood(), 'held');
  h.send({ type: 'drop' });
  assert.equal(h.mood(), 'falling');
  h.send({ type: 'land' });
  assert.equal(h.mood(), 'working');
});

test('held and falling outrank even an alert', () => {
  const h = harness();
  h.claude('UserPromptSubmit').permission().send({ type: 'grab' });
  assert.equal(h.mood(), 'held');
});

test('drop without grab, and stray lands, are ignored', () => {
  const h = harness();
  h.send({ type: 'drop' });
  assert.equal(h.mood(), 'wander');
  h.send({ type: 'grab' }).send({ type: 'drop' }).send({ type: 'drop' });
  assert.equal(h.mood(), 'falling');
  h.send({ type: 'land' }).send({ type: 'land' });
  assert.equal(h.mood(), 'wander');
});

test('reset forgets what the pet was reacting to, but not whether you are idle', () => {
  const h = harness();
  h.claude('UserPromptSubmit', 'a').permission('b').send({ type: 'commit' })
    .send({ type: 'file-activity' }).send({ type: 'app', process: 'Zoom', title: 'Zoom Meeting', fullscreen: true });
  h.send({ type: 'reset' });
  assert.equal(h.mood(), 'wander');
  assert.deepEqual(h.result().modifiers, { meeting: false, hidden: false });
  assert.deepEqual(h.result().claude, { working: 0, waiting: 0 });

  h.send(idle(600)).claude('Stop').send({ type: 'reset' });
  assert.equal(h.mood(), 'sleeping', 'still idle');
  assert.equal(h.state.awayDone, false);
});
