import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness, SECOND, MINUTE } from './helpers/harness.js';

const edit = { type: 'file-activity', folder: 'C:\\code\\app' };
const commit = { type: 'commit', folder: 'C:\\code\\app' };

test('editing files in a watched repo makes the pet focused for 2 minutes', () => {
  const h = harness();
  h.send(edit);
  assert.equal(h.mood(), 'focused');
  h.advance(2 * MINUTE - 1);
  assert.equal(h.mood(), 'focused');
  h.advance(1);
  assert.equal(h.mood(), 'wander');
});

test('each edit extends the focus window', () => {
  const h = harness();
  h.send(edit).advance(90 * SECOND).send(edit).advance(90 * SECOND);
  assert.equal(h.mood(), 'focused');
});

test('Claude working outranks focused (its edits are file activity too)', () => {
  const h = harness();
  h.claude('UserPromptSubmit').send(edit);
  assert.equal(h.mood(), 'working');
  h.claude('Stop').advance(8 * SECOND);
  assert.equal(h.mood(), 'focused', 'back to focused once the celebration ends');
});

test('a commit celebrates for 4s', () => {
  const h = harness();
  h.send(commit);
  assert.equal(h.mood(), 'celebrating');
  h.advance(4 * SECOND - 1);
  assert.equal(h.mood(), 'celebrating');
  h.advance(1);
  assert.equal(h.mood(), 'wander');
});

test('commit then Stop: confetti first, then the rest of the happy celebration', () => {
  const h = harness();
  h.claude('UserPromptSubmit').send(commit).claude('Stop');
  assert.equal(h.mood(), 'celebrating');
  h.advance(4 * SECOND);
  assert.equal(h.mood(), 'happy');
  h.advance(4 * SECOND);
  assert.equal(h.mood(), 'wander');
});

test('a second commit restarts the celebration', () => {
  const h = harness();
  h.send(commit).advance(3 * SECOND).send(commit).advance(3 * SECOND);
  assert.equal(h.mood(), 'celebrating');
});

test('a commit wakes the sleeping pet briefly', () => {
  const h = harness();
  h.send({ type: 'idle-time', seconds: 900 }).send(commit);
  assert.equal(h.mood(), 'celebrating');
  h.advance(4 * SECOND);
  assert.equal(h.mood(), 'sleeping');
});
