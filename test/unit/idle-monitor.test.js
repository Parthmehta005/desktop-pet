import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createIdleMonitor } from '../../src/main/sources/idle-monitor.js';
import { createEngine } from '../../src/core/engine.js';

function fakePowerMonitor(idleSeconds = 0) {
  const pm = new EventEmitter();
  pm.idle = idleSeconds;
  pm.getSystemIdleTime = () => pm.idle;
  return pm;
}

function idleHarness() {
  const pm = fakePowerMonitor();
  const events = [];
  let tick = null;
  const monitor = createIdleMonitor({
    powerMonitor: pm,
    emit: (e) => events.push(e),
    setInterval: (fn) => { tick = fn; return 1; },
    clearInterval: () => { tick = null; },
  });
  return { pm, events, monitor, tick: () => tick?.() };
}

test('the idle monitor reports idle time on start and every poll', () => {
  const h = idleHarness();
  h.monitor.start();
  h.pm.idle = 42;
  h.tick();
  assert.deepEqual(h.events, [{ type: 'idle-time', seconds: 0 }, { type: 'idle-time', seconds: 42 }]);
});

test('lock/suspend and unlock/resume are reported, and stop removes the listeners', () => {
  const h = idleHarness();
  h.monitor.start();
  h.events.length = 0;
  h.pm.emit('lock-screen');
  h.pm.emit('unlock-screen');
  h.pm.emit('suspend');
  h.pm.emit('resume');
  assert.deepEqual(h.events.map((e) => e.type), ['lock', 'unlock', 'lock', 'unlock']);
  h.monitor.stop();
  h.pm.emit('lock-screen');
  assert.equal(h.events.length, 4);
  assert.equal(h.pm.listenerCount('lock-screen'), 0);
});

test('with the engine: crossing the idle threshold sleeps, lock sleeps, unlock greets, 90 busy minutes stretch', () => {
  const h = idleHarness();
  const engine = createEngine();
  let now = new Date(2026, 10, 26, 14, 0).getTime();
  const send = () => { let r; for (const e of h.events.splice(0)) r = engine.dispatch(e, now); return r?.mood ?? engine.mood(now).mood; };

  h.monitor.start();
  send();
  h.pm.idle = 299; h.tick();
  assert.equal(send(), 'wander');
  h.pm.idle = 300; h.tick();
  assert.equal(send(), 'sleeping');
  h.pm.idle = 0; h.tick();
  assert.equal(send(), 'greeting');

  h.pm.emit('lock-screen');
  assert.equal(send(), 'sleeping');
  h.pm.emit('unlock-screen');
  assert.equal(send(), 'greeting');

  // Active for 90 minutes, polled every 5 seconds.
  let mood;
  for (let t = 0; t < 90 * 60; t += 5) {
    now += 5000;
    h.pm.idle = 3; h.tick();
    mood = send();
    if (mood === 'stretch') break;
  }
  assert.equal(mood, 'stretch');
});
