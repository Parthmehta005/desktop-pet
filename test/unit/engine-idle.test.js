import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness, SECOND, MINUTE } from './helpers/harness.js';

const idle = (seconds) => ({ type: 'idle-time', seconds });

test('the pet falls asleep once idle time reaches idleMinutes', () => {
  const h = harness({ idleMinutes: 5 });
  h.send(idle(299));
  assert.equal(h.mood(), 'wander');
  h.send(idle(300));
  assert.equal(h.mood(), 'sleeping');
  h.advance(2 * 60 * MINUTE);
  assert.equal(h.mood(), 'sleeping', 'stays asleep with no further input');
});

test('idleMinutes is configurable', () => {
  const h = harness({ idleMinutes: 1 });
  h.send(idle(59));
  assert.equal(h.mood(), 'wander');
  h.send(idle(60));
  assert.equal(h.mood(), 'sleeping');
});

test('coming back from idle greets the user for 3s', () => {
  const h = harness();
  h.send(idle(600));
  h.send(idle(0));
  assert.equal(h.mood(), 'greeting');
  h.advance(3 * SECOND - 1);
  assert.equal(h.mood(), 'greeting');
  h.advance(1);
  assert.equal(h.mood(), 'wander');
});

test('small idle times while active do not greet', () => {
  const h = harness();
  h.send(idle(10)).send(idle(0)).send(idle(42));
  assert.equal(h.mood(), 'wander');
});

test('locking the screen sleeps at once; unlocking greets', () => {
  const h = harness();
  h.send({ type: 'lock' });
  assert.equal(h.mood(), 'sleeping');
  h.send(idle(0));
  assert.equal(h.mood(), 'sleeping', 'still locked, whatever the idle time says');
  h.send({ type: 'unlock' });
  assert.equal(h.mood(), 'greeting');
});

test('the app greets on start', () => {
  const h = harness();
  h.send({ type: 'app-start' });
  assert.equal(h.mood(), 'greeting');
  h.advance(3 * SECOND);
  assert.equal(h.mood(), 'wander');
});

test('Claude finishing while you are idle waits for you: away-done, then happy on return', () => {
  const h = harness();
  h.claude('UserPromptSubmit');
  h.send(idle(600));
  assert.equal(h.mood(), 'working', 'sweating beats sleeping');
  h.claude('Stop');
  assert.equal(h.mood(), 'away-done');
  h.advance(90 * MINUTE);
  assert.equal(h.mood(), 'away-done', 'the flag is held as long as you are away');
  h.send(idle(0));
  assert.equal(h.mood(), 'happy', 'the celebration plays when you return');
  h.advance(8 * SECOND);
  assert.equal(h.mood(), 'wander', 'greeting (3s) has already finished under the 8s happy');
  assert.equal(h.state.awayDone, false);
});

test('unlocking also delivers the away-done news', () => {
  const h = harness();
  h.send({ type: 'lock' }).claude('Stop');
  assert.equal(h.mood(), 'away-done');
  h.send({ type: 'unlock' });
  assert.equal(h.mood(), 'happy');
});

test('a Claude alert shows even while you are idle', () => {
  const h = harness();
  h.send(idle(600)).claude('UserPromptSubmit').permission();
  assert.equal(h.mood(), 'alert');
});

test('a celebration that started before you went idle finishes first', () => {
  const h = harness();
  h.claude('Stop');
  h.advance(2 * SECOND).send(idle(600));
  assert.equal(h.mood(), 'happy');
  h.advance(6 * SECOND);
  assert.equal(h.mood(), 'sleeping');
});

test('nonsense idle times are ignored', () => {
  const h = harness();
  for (const seconds of [-1, Number.NaN, 'soon', undefined, Infinity]) h.send(idle(seconds));
  assert.equal(h.mood(), 'wander');
  assert.equal(h.state.user.idleSeconds, 0);
});
