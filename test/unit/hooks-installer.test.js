import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  hookCommand, claudeSettingsPath, installHooks, uninstallHooks, readHookStatus,
  addHooks, removeHooks, HOOK_MARKER,
} from '../../src/main/hooks-installer.js';
import { INSTALLED_HOOK_EVENTS } from '../../src/core/claude-hooks.js';

const TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718';
const OPTS = { port: 47321, token: TOKEN, shell: 'posix' };

async function tempHome() {
  return mkdtemp(path.join(tmpdir(), 'desktop-pet-claude-'));
}
const settingsIn = (home) => path.join(home, '.claude', 'settings.json');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

/** A realistic settings.json with the user's own hooks and settings. */
const USER_SETTINGS = {
  model: 'opus',
  permissions: { allow: ['Bash(npm test)'], deny: [] },
  hooks: {
    PostToolUse: [
      { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'npx prettier --write "$CLAUDE_FILE_PATHS"' }] },
    ],
    PreCompact: [{ hooks: [{ type: 'command', command: 'echo compacting' }] }],
  },
  statusLine: { type: 'command', command: 'echo hi' },
};

async function withUserSettings() {
  const home = await tempHome();
  const file = settingsIn(home);
  await mkdir(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify(USER_SETTINGS, null, 4)}\n`; // the user's own formatting
  await writeFile(file, text, 'utf8');
  return { home, file, text };
}

test('hookCommand: curl.exe on Windows, curl elsewhere, quiet and non-blocking', () => {
  const win = hookCommand({ ...OPTS, shell: 'windows' });
  assert.match(win, /^curl\.exe -s -m 2 /);
  assert.ok(win.includes(`X-Pet-Token: ${TOKEN}`));
  assert.ok(win.includes(`http://127.0.0.1:47321${HOOK_MARKER}`));
  assert.ok(win.includes('--data-binary @-'), 'forwards the hook payload from stdin');
  assert.ok(win.includes('--noproxy 127.0.0.1 '), 'a configured proxy never sees the local post');
  assert.ok(win.endsWith('|| exit 0'), 'never fails the hook when the pet is not running');
  assert.match(hookCommand(OPTS), /^curl -s -m 2 /);
  const wsl = hookCommand({ ...OPTS, host: 'windows-host.local' });
  assert.ok(wsl.includes('http://windows-host.local:47321'));
  assert.ok(wsl.includes('--noproxy windows-host.local '));
});

test('hookCommand rejects values that could break the command line', () => {
  assert.throws(() => hookCommand({ ...OPTS, token: 'short' }), /token/);
  assert.throws(() => hookCommand({ ...OPTS, token: `${TOKEN}" & calc` }), /token/);
  assert.throws(() => hookCommand({ ...OPTS, port: 0 }), /port/);
  assert.throws(() => hookCommand({ ...OPTS, port: '47321' }), /port/);
  assert.throws(() => hookCommand({ ...OPTS, host: 'evil.com; rm -rf ~' }), /host/);
  assert.throws(() => hookCommand({ ...OPTS, shell: 'fish' }), /shell/);
});

test('claudeSettingsPath: ~/.claude/settings.json, or CLAUDE_CONFIG_DIR', () => {
  assert.equal(claudeSettingsPath({}, '/home/me'), path.join('/home/me', '.claude', 'settings.json'));
  assert.equal(claudeSettingsPath({ CLAUDE_CONFIG_DIR: '/custom/claude' }, '/home/me'), path.join('/custom/claude', 'settings.json'));
});

test('install creates settings.json (and its folder) when missing, with no backup', async () => {
  const home = await tempHome();
  const result = await installHooks({ settingsPath: settingsIn(home), ...OPTS });
  assert.equal(result.changed, true);
  assert.equal(result.backup, null);
  const saved = await readJson(settingsIn(home));
  assert.deepEqual(Object.keys(saved.hooks), [...INSTALLED_HOOK_EVENTS]);
  for (const event of INSTALLED_HOOK_EVENTS) {
    const [group] = saved.hooks[event];
    assert.equal(group.hooks[0].command, hookCommand(OPTS));
    assert.equal(group.hooks[0].type, 'command');
    assert.equal(group.hooks[0].timeout, 5);
    assert.equal(group.matcher, ['PreToolUse', 'PostToolUse'].includes(event) ? '*' : undefined, event);
  }
});

test("install keeps the user's own hooks and settings, and backs the file up first", async () => {
  const { file, text } = await withUserSettings();
  const result = await installHooks({ settingsPath: file, ...OPTS });
  assert.equal(result.changed, true);
  assert.equal(await readFile(result.backup, 'utf8'), text, 'the backup is the untouched original');
  const saved = await readJson(file);
  assert.equal(saved.model, 'opus');
  assert.deepEqual(saved.permissions, USER_SETTINGS.permissions);
  assert.deepEqual(saved.statusLine, USER_SETTINGS.statusLine);
  assert.deepEqual(saved.hooks.PreCompact, USER_SETTINGS.hooks.PreCompact);
  assert.deepEqual(saved.hooks.PostToolUse[0], USER_SETTINGS.hooks.PostToolUse[0], "the user's hook stays first");
  assert.equal(saved.hooks.PostToolUse.length, 2);
});

test('a second install with the same settings changes nothing and makes no backup', async () => {
  const { home, file } = await withUserSettings();
  await installHooks({ settingsPath: file, ...OPTS });
  const after = await readFile(file, 'utf8');
  const backups = (await readdir(path.join(home, '.claude'))).filter((f) => f.includes('backup'));
  const again = await installHooks({ settingsPath: file, ...OPTS });
  assert.deepEqual(again, { changed: false, settingsPath: file, backup: null });
  assert.equal(await readFile(file, 'utf8'), after);
  assert.deepEqual((await readdir(path.join(home, '.claude'))).filter((f) => f.includes('backup')), backups);
});

test('reinstalling for a new port or token replaces the old entries (no duplicates)', async () => {
  const { file } = await withUserSettings();
  await installHooks({ settingsPath: file, ...OPTS });
  await installHooks({ settingsPath: file, ...OPTS, port: 50000, now: new Date(2030, 0, 1) });
  const saved = await readJson(file);
  const ours = Object.values(saved.hooks).flat().flatMap((g) => g.hooks).filter((h) => h.command.includes(HOOK_MARKER));
  assert.equal(ours.length, INSTALLED_HOOK_EVENTS.length);
  assert.ok(ours.every((h) => h.command.includes(':50000/')));
});

test('uninstall leaves a file equivalent to the original', async () => {
  const { file } = await withUserSettings();
  await installHooks({ settingsPath: file, ...OPTS });
  const result = await uninstallHooks({ settingsPath: file, now: new Date(2030, 0, 1) });
  assert.equal(result.changed, true);
  assert.ok(result.backup);
  assert.deepEqual(await readJson(file), USER_SETTINGS);
});

test('install then uninstall on a fresh machine leaves empty settings', async () => {
  const home = await tempHome();
  await installHooks({ settingsPath: settingsIn(home), ...OPTS });
  await uninstallHooks({ settingsPath: settingsIn(home) });
  assert.deepEqual(await readJson(settingsIn(home)), {});
});

test('uninstall with nothing to remove changes nothing', async () => {
  const { file, text } = await withUserSettings();
  assert.equal((await uninstallHooks({ settingsPath: file })).changed, false);
  assert.equal(await readFile(file, 'utf8'), text);
  const home = await tempHome();
  assert.equal((await uninstallHooks({ settingsPath: settingsIn(home) })).changed, false);
});

test('a malformed settings.json is never touched', async () => {
  const home = await tempHome();
  const file = settingsIn(home);
  await mkdir(path.dirname(file), { recursive: true });
  const broken = '{ "model": "opus", // a comment is not JSON\n}';
  await writeFile(file, broken, 'utf8');
  await assert.rejects(installHooks({ settingsPath: file, ...OPTS }), /not valid JSON, so it was left alone/);
  await assert.rejects(uninstallHooks({ settingsPath: file }), /left alone/);
  assert.equal(await readFile(file, 'utf8'), broken);
  assert.deepEqual(await readdir(path.dirname(file)), ['settings.json'], 'no backup or temp file either');
  assert.equal((await readHookStatus({ settingsPath: file, ...OPTS })).status, 'invalid-settings');

  await writeFile(file, '[1, 2]', 'utf8');
  await assert.rejects(installHooks({ settingsPath: file, ...OPTS }), /not a JSON object/);
});

test('status: not installed, installed, outdated', async () => {
  const { file } = await withUserSettings();
  assert.equal((await readHookStatus({ settingsPath: file, ...OPTS })).status, 'not-installed');
  await installHooks({ settingsPath: file, ...OPTS });
  assert.equal((await readHookStatus({ settingsPath: file, ...OPTS })).status, 'installed');
  assert.equal((await readHookStatus({ settingsPath: file, ...OPTS, port: 50000 })).status, 'outdated');
  assert.equal((await readHookStatus({ settingsPath: file, ...OPTS, token: TOKEN.replace('a', 'b') })).status, 'outdated');
  const home = await tempHome();
  assert.equal((await readHookStatus({ settingsPath: settingsIn(home), ...OPTS })).status, 'not-installed');

  // Someone deleted one of the pet's hooks by hand.
  const saved = await readJson(file);
  delete saved.hooks.Stop;
  await writeFile(file, JSON.stringify(saved), 'utf8');
  assert.equal((await readHookStatus({ settingsPath: file, ...OPTS })).status, 'outdated');
});

test("removeHooks only takes the pet's entries out of a group shared with the user's", () => {
  const theirs = { type: 'command', command: 'echo mine' };
  const ours = { type: 'command', command: hookCommand(OPTS) };
  const settings = { hooks: { Stop: [{ hooks: [theirs, ours] }], Weird: 'not an array' } };
  assert.deepEqual(removeHooks(settings), { hooks: { Stop: [{ hooks: [theirs] }], Weird: 'not an array' } });
  assert.deepEqual(settings.hooks.Stop[0].hooks.length, 2, 'the input is not modified');
});

test('addHooks copes with a hooks value that is not an object', () => {
  const next = addHooks({ hooks: ['nonsense'] }, hookCommand(OPTS));
  assert.deepEqual(Object.keys(next.hooks), [...INSTALLED_HOOK_EVENTS]);
});
