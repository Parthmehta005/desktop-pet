// The low-battery panic: when it starts and stops, the setting, and that it beats a
// meeting and a fullscreen app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/harness.js';
import { batteryLow, createEngineState, reduce } from '../../src/core/engine.js';

const battery = (percent, { charging = false, present = true } = {}) => ({ type: 'battery', percent, charging, present });

test('panics at or below 10% on battery, and only then', () => {
  const h = harness();
  assert.equal(h.send(battery(50)).mood(), 'wander');
  assert.equal(h.send(battery(11)).mood(), 'wander');
  assert.equal(h.send(battery(10)).mood(), 'low-battery', 'at the threshold');
  assert.equal(h.send(battery(3)).mood(), 'low-battery');
  assert.equal(h.send(battery(3, { charging: true })).mood(), 'wander', 'plugging in calms it at once');
  assert.equal(h.send(battery(3)).mood(), 'low-battery', 'unplugging again brings it back');
});

test('a computer without a battery never panics, whatever it reports', () => {
  const h = harness().send(battery(0, { present: false }));
  assert.equal(h.mood(), 'wander');
});

test('the threshold is a setting, and 0 turns the panic off', () => {
  const h = harness().send(battery(25));
  assert.equal(h.mood(), 'wander');
  assert.equal(h.send({ type: 'config', config: { lowBatteryPercent: 30 } }).mood(), 'low-battery');
  assert.equal(h.send({ type: 'config', config: { lowBatteryPercent: 0 } }).mood(), 'wander');
  assert.equal(harness({ lowBatteryPercent: 0 }).send(battery(1)).mood(), 'wander');
});

test('it beats a meeting and a fullscreen app: no fading, no hiding', () => {
  const h = harness().send({ type: 'app', process: 'Zoom', title: 'Zoom Meeting', fullscreen: true });
  assert.deepEqual(h.result().modifiers, { meeting: true, hidden: true });
  h.send(battery(5));
  assert.equal(h.mood(), 'low-battery');
  assert.deepEqual(h.result().modifiers, { meeting: false, hidden: false });
  h.send(battery(5, { charging: true }));
  assert.deepEqual(h.result().modifiers, { meeting: true, hidden: true }, 'they come back once it is plugged in');
});

test('being carried or dropped still shows; the panic resumes afterwards', () => {
  const h = harness().send(battery(5));
  assert.equal(h.send({ type: 'grab' }).mood(), 'held');
  assert.equal(h.send({ type: 'drop' }).mood(), 'falling');
  assert.equal(h.send({ type: 'land' }).mood(), 'low-battery');
});

test('bad battery reports are ignored, and values are kept in range', () => {
  const h = harness().send(battery(5));
  for (const bad of [{ type: 'battery' }, { type: 'battery', percent: 'x' }, { type: 'battery', percent: Number.NaN }]) {
    h.send(bad);
    assert.equal(h.mood(), 'low-battery', JSON.stringify(bad));
  }
  const state = reduce(createEngineState(), battery(-20), 0);
  assert.equal(state.battery.percent, 0);
  assert.equal(reduce(createEngineState(), battery(250), 0).battery.percent, 100);
  assert.equal(batteryLow(createEngineState()), false, 'no report yet: no panic');
});

test('pausing (reset) forgets reactions but not the battery', () => {
  const h = harness().send(battery(5)).send({ type: 'reset' });
  assert.equal(h.mood(), 'low-battery');
});
