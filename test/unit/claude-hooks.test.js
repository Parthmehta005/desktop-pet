import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hookToEvent, HOOK_EVENTS, INSTALLED_HOOK_EVENTS } from '../../src/core/claude-hooks.js';
import { createEngine } from '../../src/core/engine.js';

// Shaped like the JSON Claude Code sends a hook on stdin.
const payload = (hook, extra = {}) => ({
  session_id: 'sess-1',
  transcript_path: 'C:\\Users\\me\\.claude\\projects\\x\\sess-1.jsonl',
  cwd: 'C:\\Users\\me\\code\\my-app',
  hook_event_name: hook,
  ...extra,
});

test('a hook payload becomes a claude engine event', () => {
  assert.deepEqual(hookToEvent(payload('UserPromptSubmit', { prompt: 'fix the tests' })), {
    event: { type: 'claude', hook: 'UserPromptSubmit', sessionId: 'sess-1' },
    folder: null,
  });
  const note = hookToEvent(payload('Notification', {
    notification_type: 'permission_prompt',
    message: 'Claude needs your permission to use Bash',
  }));
  assert.deepEqual(note.event, {
    type: 'claude',
    hook: 'Notification',
    sessionId: 'sess-1',
    notificationType: 'permission_prompt',
    message: 'Claude needs your permission to use Bash',
  });
});

test('the prompt, tool input and other fields are not passed on', () => {
  const { event } = hookToEvent(payload('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, prompt: 'secret' }));
  assert.deepEqual(Object.keys(event).sort(), ['hook', 'sessionId', 'type']);
});

test('with no watched folders configured, every session counts', () => {
  const r = hookToEvent(payload('Stop', { cwd: '/somewhere/else' }), { watchedFolders: [] });
  assert.equal(r.event.hook, 'Stop');
});

test('with watched folders, only sessions inside them count', () => {
  const config = { watchedFolders: ['c:/users/ME/Code/my-app'] };
  const inside = hookToEvent(payload('Stop', { cwd: 'C:\\Users\\me\\code\\my-app\\packages\\web' }), config);
  assert.equal(inside.event.hook, 'Stop');
  assert.equal(inside.folder, 'c:/users/ME/Code/my-app', 'a Windows cwd matches a folder written in another case');
  assert.deepEqual(hookToEvent(payload('Stop', { cwd: 'C:\\Users\\me\\code\\my-app2' }), config), { ignored: 'outside watched folders' });
  assert.deepEqual(hookToEvent(payload('Stop', { cwd: undefined }), config), { ignored: 'outside watched folders' });
});

test('a session in WSL matches the same folder on the Windows side', () => {
  const r = hookToEvent(payload('Stop', { cwd: '/mnt/c/Users/me/code/my-app' }), { watchedFolders: ['C:\\Users\\me\\code\\my-app'] });
  assert.equal(r.folder, 'C:\\Users\\me\\code\\my-app');
});

test('"react to all Claude sessions" lets everything through', () => {
  const r = hookToEvent(payload('Stop', { cwd: 'D:\\elsewhere' }), { watchedFolders: ['C:\\code'], reactToAllSessions: true });
  assert.equal(r.event.hook, 'Stop');
  assert.equal(r.folder, null);
});

test('unknown hooks and junk are ignored', () => {
  assert.match(hookToEvent(payload('PreCompact')).ignored, /unknown hook/);
  assert.match(hookToEvent({}).ignored, /unknown hook/);
  for (const junk of [null, 'Stop', 42, ['Stop']]) assert.equal(hookToEvent(junk).ignored, 'not an object');
});

test('long or odd fields are trimmed or dropped', () => {
  const { event } = hookToEvent(payload('Notification', {
    session_id: 'x'.repeat(1000), message: 'm'.repeat(5000), notification_type: 42,
  }));
  assert.equal(event.sessionId.length, 200);
  assert.equal(event.message.length, 500);
  assert.equal('notificationType' in event, false);
  assert.equal(hookToEvent(payload('Stop', { session_id: 7 })).event.sessionId, '');
});

test('every installed hook is one the engine understands', () => {
  for (const hook of INSTALLED_HOOK_EVENTS) assert.ok(HOOK_EVENTS.includes(hook), hook);
});

test('a real-looking session drives the engine through working, alert, working, happy', () => {
  const engine = createEngine();
  const t = new Date(2026, 10, 26, 14, 0).getTime();
  const moods = [
    payload('SessionStart', { source: 'startup' }),
    payload('UserPromptSubmit', { prompt: 'add a test' }),
    payload('PreToolUse', { tool_name: 'Bash' }),
    payload('Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }),
    payload('PostToolUse', { tool_name: 'Bash' }),
    payload('Stop', { stop_hook_active: false }),
  ].map((p, i) => engine.dispatch(hookToEvent(p).event, t + i * 1000).mood);
  assert.deepEqual(moods, ['wander', 'working', 'working', 'alert', 'working', 'happy']);
});
