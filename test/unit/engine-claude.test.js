import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngineState, reduce, selectMood, classifyNotification } from '../../src/core/engine.js';
import { harness, T0, SECOND, MINUTE } from './helpers/harness.js';

test('a fresh pet wanders', () => {
  const h = harness();
  assert.deepEqual(h.result(), {
    mood: 'wander',
    intensity: 1,
    modifiers: { meeting: false, hidden: false },
    claude: { working: 0, waiting: 0 },
  });
});

test('a prompt makes the pet work; Stop makes it happy, then it wanders again', () => {
  const h = harness();
  h.claude('UserPromptSubmit');
  assert.equal(h.mood(), 'working');
  h.advance(30 * SECOND).claude('PostToolUse');
  assert.equal(h.mood(), 'working');
  h.advance(30 * SECOND).claude('Stop');
  assert.equal(h.mood(), 'happy');
  h.advance(8 * SECOND - 1);
  assert.equal(h.mood(), 'happy', 'still happy just before 8s');
  h.advance(1);
  assert.equal(h.mood(), 'wander', 'happy lasts exactly 8s');
});

test('tool activity alone counts as working (pet started mid-task)', () => {
  const h = harness();
  h.claude('PreToolUse');
  assert.equal(h.mood(), 'working');
});

test('Stop from a session the pet never saw still makes it happy', () => {
  const h = harness();
  h.claude('Stop', 'unknown');
  assert.equal(h.mood(), 'happy');
});

test('a permission prompt raises an alert until the tool runs', () => {
  const h = harness();
  h.claude('UserPromptSubmit').claude('PreToolUse').permission();
  assert.equal(h.mood(), 'alert');
  h.advance(5 * MINUTE);
  assert.equal(h.mood(), 'alert', 'waiting for you does not go stale quickly');
  h.claude('PostToolUse');
  assert.equal(h.mood(), 'working');
});

test('a new prompt also clears the alert', () => {
  const h = harness();
  h.claude('UserPromptSubmit').permission();
  h.claude('UserPromptSubmit');
  assert.equal(h.mood(), 'working');
});

test('Stop clears the alert and makes the pet happy', () => {
  const h = harness();
  h.claude('UserPromptSubmit').permission().claude('Stop');
  assert.equal(h.mood(), 'happy');
});

test('an idle-prompt notification does not raise an alert', () => {
  const h = harness();
  h.claude('UserPromptSubmit').claude('Stop').advance(60 * SECOND);
  h.claude('Notification', 's1', { notificationType: 'idle_prompt', message: 'Claude is waiting for your input' });
  assert.equal(h.mood(), 'wander');
});

test('a notification that does not need the user is ignored', () => {
  const h = harness();
  h.claude('UserPromptSubmit');
  h.claude('Notification', 's1', { notificationType: 'auth_success', message: 'Signed in' });
  assert.equal(h.mood(), 'working');
});

test('an unanswered alert times out after alertTimeoutMinutes', () => {
  const h = harness({ alertTimeoutMinutes: 30 });
  h.claude('UserPromptSubmit').permission();
  h.advance(30 * MINUTE - 1);
  assert.equal(h.mood(), 'alert');
  h.advance(1);
  assert.equal(h.mood(), 'wander');
});

test('a silent working session goes stale after workingStaleMinutes', () => {
  const h = harness({ workingStaleMinutes: 10 });
  h.claude('UserPromptSubmit');
  h.advance(10 * MINUTE - 1);
  assert.equal(h.mood(), 'working');
  h.advance(1);
  assert.equal(h.mood(), 'wander', 'interrupted sessions stop sweating');
  h.claude('PostToolUse');
  assert.equal(h.mood(), 'working', 'and start again on the next event');
});

test('working intensity follows the number of busy sessions', () => {
  const h = harness();
  h.claude('UserPromptSubmit', 'a');
  assert.deepEqual([h.mood(), h.result().intensity], ['working', 1]);
  h.claude('UserPromptSubmit', 'b');
  assert.equal(h.result().intensity, 2);
  h.claude('UserPromptSubmit', 'c');
  assert.equal(h.result().intensity, 3);
  h.claude('UserPromptSubmit', 'd');
  assert.equal(h.result().intensity, 3, 'capped at 3');
  assert.equal(h.result().claude.working, 4);
});

test('two sessions, one stops: brief happy, then back to working at intensity 1', () => {
  const h = harness();
  h.claude('UserPromptSubmit', 'a').claude('UserPromptSubmit', 'b');
  assert.equal(h.result().intensity, 2);
  h.claude('Stop', 'a');
  assert.equal(h.mood(), 'happy');
  h.advance(4 * SECOND).claude('PostToolUse', 'b');
  assert.equal(h.mood(), 'happy', "the other session's tool use doesn't cut the celebration short");
  h.advance(4 * SECOND);
  assert.deepEqual([h.mood(), h.result().intensity], ['working', 1]);
});

test('a new prompt ends the previous "Done!" early', () => {
  const h = harness();
  h.claude('UserPromptSubmit').claude('Stop');
  assert.equal(h.mood(), 'happy');
  h.advance(2 * SECOND).claude('UserPromptSubmit');
  assert.equal(h.mood(), 'working');
});

test('one session waiting and another working: the alert wins', () => {
  const h = harness();
  h.claude('UserPromptSubmit', 'a').claude('UserPromptSubmit', 'b').permission('b');
  assert.equal(h.mood(), 'alert');
  assert.deepEqual(h.result().claude, { working: 1, waiting: 1 });
});

test('SessionEnd forgets the session without celebrating', () => {
  const h = harness();
  h.claude('UserPromptSubmit').claude('SessionEnd');
  assert.equal(h.mood(), 'wander');
  assert.deepEqual(h.state.sessions, {});
});

test('SessionStart and SubagentStop register activity without changing the mood', () => {
  const h = harness();
  h.claude('SessionStart');
  assert.equal(h.mood(), 'wander');
  h.claude('UserPromptSubmit').claude('SubagentStop');
  assert.equal(h.mood(), 'working', 'a subagent finishing is not Claude finishing');
});

test('events without a session id share one default session', () => {
  const h = harness();
  h.send({ type: 'claude', hook: 'UserPromptSubmit' });
  h.send({ type: 'claude', hook: 'Stop', sessionId: '' });
  assert.equal(h.mood(), 'happy');
  assert.deepEqual(Object.keys(h.state.sessions), ['default']);
});

test('sessions silent for a day are forgotten', () => {
  const h = harness();
  h.claude('SessionStart', 'old');
  h.advance(24 * 60 * MINUTE + 1);
  assert.deepEqual(h.state.sessions, {});
});

test('unknown hooks and event types change nothing', () => {
  const state = createEngineState({}, T0);
  assert.equal(reduce(state, { type: 'claude', hook: 'MadeUpHook', sessionId: 'x' }, T0).sessions.x, undefined);
  assert.equal(reduce(state, { type: 'nonsense' }, T0), state);
  assert.equal(reduce(state, null, T0), state);
  assert.equal(reduce(state, 'tick', T0), state);
  assert.equal(reduce(state, { type: 'tick' }, Number.NaN), state);
});

test('reduce never mutates its input', () => {
  const s0 = createEngineState({}, T0);
  const s1 = reduce(s0, { type: 'claude', hook: 'UserPromptSubmit', sessionId: 'a' }, T0);
  const s2 = reduce(s1, { type: 'claude', hook: 'Stop', sessionId: 'a' }, T0 + 1);
  assert.deepEqual(s0.sessions, {});
  assert.equal(s1.sessions.a.status, 'working');
  assert.deepEqual(s1.timers, {});
  assert.equal(s2.sessions.a.status, 'idle');
  assert.equal(selectMood(s1, T0).mood, 'working', 'old states still answer correctly');
  assert.ok(Object.isFrozen(s2) && Object.isFrozen(s2.sessions) && Object.isFrozen(s2.timers));
});

test('classifyNotification', () => {
  assert.equal(classifyNotification({ notificationType: 'permission_prompt' }), 'needs-input');
  assert.equal(classifyNotification({ notificationType: 'elicitation_dialog' }), 'needs-input');
  assert.equal(classifyNotification({ notificationType: 'idle_prompt' }), 'idle');
  assert.equal(classifyNotification({ notificationType: 'auth_success' }), 'other');
  assert.equal(classifyNotification({ notificationType: 'something_new' }), 'other');
  // Message-only payloads from older Claude Code versions.
  assert.equal(classifyNotification({ message: 'Claude needs your permission to use Bash' }), 'needs-input');
  assert.equal(classifyNotification({ message: 'Claude is waiting for your input' }), 'idle');
  assert.equal(classifyNotification({}), 'needs-input');
  assert.equal(classifyNotification(), 'needs-input');
});
