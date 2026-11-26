import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harness } from './helpers/harness.js';

const app = (process, title = '', extra = {}) => ({ type: 'app', process, title, ...extra });
const spotify = app('Spotify', 'Spotify Premium');
const youtube = app('chrome', 'Cats - YouTube - Google Chrome');
const game = app('game', 'Game', { path: 'D:\\Steam\\steamapps\\common\\G\\game.exe' });
const zoom = app('Zoom', 'Zoom Meeting');
const editor = app('Code', 'engine.js - Visual Studio Code');

test('foreground apps set the matching mood', () => {
  const h = harness();
  assert.equal(h.send(spotify).mood(), 'vibing');
  assert.equal(h.send(game).mood(), 'gaming');
  assert.equal(h.send(youtube).mood(), 'watching');
  assert.equal(h.send(editor).mood(), 'wander', 'switching back to work clears it');
});

test('a meeting is a modifier: quiet and still, mood unchanged', () => {
  const h = harness();
  h.claude('UserPromptSubmit').send(zoom);
  assert.equal(h.mood(), 'working');
  assert.deepEqual(h.result().modifiers, { meeting: true, hidden: false });
  h.send(editor);
  assert.deepEqual(h.result().modifiers, { meeting: false, hidden: false });
});

test('quietDuringMeetings: false turns meeting mode off', () => {
  const h = harness({ quietDuringMeetings: false });
  h.send(zoom);
  assert.equal(h.result().modifiers.meeting, false);
});

test('a fullscreen app hides the pet when hideWhenFullscreen is on', () => {
  const h = harness();
  h.send({ ...game, fullscreen: true });
  assert.equal(h.mood(), 'gaming');
  assert.equal(h.result().modifiers.hidden, true);
  h.send({ ...game, fullscreen: false });
  assert.equal(h.result().modifiers.hidden, false);
});

test('hideWhenFullscreen: false keeps the pet visible', () => {
  const h = harness({ hideWhenFullscreen: false });
  h.send({ ...youtube, fullscreen: true });
  assert.equal(h.result().modifiers.hidden, false);
});

test('only a literal true counts as fullscreen', () => {
  const h = harness();
  h.send({ ...youtube, fullscreen: 'yes' });
  assert.equal(h.result().modifiers.hidden, false);
});

test('custom app rules from config are used', () => {
  const h = harness({ appRules: [{ process: '^figma$', mood: 'vibing' }] });
  assert.equal(h.send(app('Figma', 'Design')).mood(), 'vibing');
  assert.equal(h.send(spotify).mood(), 'wander', 'custom rules replace the defaults');
});

test('invalid custom rules are skipped, valid ones still work', () => {
  const h = harness({ appRules: [{ title: '(oops', mood: 'gaming' }, { title: 'Chess', mood: 'gaming' }] });
  assert.equal(h.send(app('x', 'Chess.com')).mood(), 'gaming');
});

test('a config change re-evaluates the current foreground app', () => {
  const h = harness();
  h.send(app('Figma', 'Design'));
  assert.equal(h.mood(), 'wander');
  h.send({ type: 'config', config: { appRules: [{ process: '^figma$', mood: 'vibing' }] } });
  assert.equal(h.mood(), 'vibing');
});

test('a config change to idleMinutes applies to the current idle time', () => {
  const h = harness({ idleMinutes: 10 });
  h.send({ type: 'idle-time', seconds: 400 });
  assert.equal(h.mood(), 'wander');
  h.send({ type: 'config', config: { idleMinutes: 5 } });
  assert.equal(h.mood(), 'sleeping');
  h.send({ type: 'config', config: { idleMinutes: 10 } });
  assert.equal(h.mood(), 'greeting', 'raising the threshold counts as coming back');
});

test('config events ignore unknown keys and bad payloads', () => {
  const h = harness();
  h.send({ type: 'config', config: { notAKey: 1 } }).send({ type: 'config' }).send({ type: 'config', config: 'x' });
  assert.equal(h.state.config.notAKey, undefined);
  assert.equal(h.state.config.idleMinutes, 5);
});

test('app moods lose to sleeping and to Claude', () => {
  const h = harness();
  h.send(spotify).send({ type: 'idle-time', seconds: 600 });
  assert.equal(h.mood(), 'sleeping');
  h.send({ type: 'idle-time', seconds: 0 }).claude('UserPromptSubmit');
  assert.equal(h.mood(), 'working');
});

test('non-string window fields are treated as empty', () => {
  const h = harness();
  h.send({ type: 'app', process: 42, title: { a: 1 } });
  assert.deepEqual(h.state.app, { process: '', title: '', path: '', fullscreen: false });
  assert.equal(h.mood(), 'wander');
});
