import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from '../../scripts/hooks.js';
import { userDataDir, appDataDir, USER_DATA_FOLDER } from '../../src/main/user-data.js';

const TOKEN = 'f'.repeat(48);

async function setup({ token = TOKEN, port = 47999 } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'desktop-pet-cli-'));
  const userData = path.join(dir, 'pet');
  const settings = path.join(dir, 'claude', 'settings.json');
  await (await import('node:fs/promises')).mkdir(userData, { recursive: true });
  await writeFile(path.join(userData, 'config.json'), JSON.stringify({ version: 1, hookPort: port, hookToken: token }));
  return { userData, settings };
}

function capture() {
  const lines = { out: [], err: [] };
  return { lines, io: { env: {}, out: (l) => lines.out.push(l), err: (l) => lines.err.push(l) } };
}

test('install, status, uninstall round trip', async () => {
  const { userData, settings } = await setup();
  const base = ['--settings', settings, '--user-data', userData];

  let c = capture();
  assert.equal(await run(['status', ...base], c.io), 1);
  assert.match(c.lines.out[0], /^Not installed/);

  c = capture();
  assert.equal(await run(['install', ...base], c.io), 0);
  assert.match(c.lines.out.join('\n'), /Installed the Desktop Pet hooks/);
  const saved = JSON.parse(await readFile(settings, 'utf8'));
  assert.ok(saved.hooks.Stop[0].hooks[0].command.includes(':47999/desktop-pet/claude-hook'));
  assert.ok(saved.hooks.Stop[0].hooks[0].command.includes(TOKEN));

  c = capture();
  assert.equal(await run(['install', ...base], c.io), 0);
  assert.match(c.lines.out[0], /already installed/);

  c = capture();
  assert.equal(await run(['status', ...base], c.io), 0);
  assert.match(c.lines.out[0], /^Installed/);

  c = capture();
  assert.equal(await run(['uninstall', '--settings', settings], c.io), 0);
  assert.match(c.lines.out.join('\n'), /Removed the Desktop Pet hooks/);
  assert.deepEqual(JSON.parse(await readFile(settings, 'utf8')), {});
});

test('status spots hooks left over from an old port', async () => {
  const { userData, settings } = await setup();
  await run(['install', '--settings', settings, '--user-data', userData], capture().io);
  await writeFile(path.join(userData, 'config.json'), JSON.stringify({ version: 1, hookPort: 48000, hookToken: TOKEN }));
  const c = capture();
  assert.equal(await run(['status', '--settings', settings, '--user-data', userData], c.io), 1);
  assert.match(c.lines.out[0], /^Out of date/);
});

test('--wsl writes plain curl hooks and needs an explicit settings file', async () => {
  const { userData, settings } = await setup();
  let c = capture();
  assert.equal(await run(['install', '--wsl', '--user-data', userData], c.io), 1);
  assert.match(c.lines.err.join('\n'), /--settings/);

  c = capture();
  assert.equal(await run(['install', '--wsl', '--settings', settings, '--user-data', userData, '--host', 'pc.local'], c.io), 0);
  const command = JSON.parse(await readFile(settings, 'utf8')).hooks.Stop[0].hooks[0].command;
  assert.match(command, /^curl -s /);
  assert.ok(command.includes('http://pc.local:47999/'));
});

test('a pet that has never run (no token yet) gets a helpful message', async () => {
  const { userData, settings } = await setup({ token: '' });
  const c = capture();
  assert.equal(await run(['install', '--settings', settings, '--user-data', userData], c.io), 1);
  assert.match(c.lines.err[0], /Start Desktop Pet once/);
});

test('bad usage prints the usage line', async () => {
  for (const argv of [[], ['frobnicate'], ['install', '--bogus'], ['install', '--settings']]) {
    const c = capture();
    assert.equal(await run(argv, c.io), 1, argv.join(' '));
    assert.match(c.lines.err.at(-1), /^Usage:/);
  }
});

test('a malformed Claude settings file is reported, not overwritten', async () => {
  const { userData, settings } = await setup();
  await (await import('node:fs/promises')).mkdir(path.dirname(settings), { recursive: true });
  await writeFile(settings, '{ broken', 'utf8');
  const c = capture();
  assert.equal(await run(['install', '--settings', settings, '--user-data', userData], c.io), 1);
  assert.match(c.lines.err[0], /left alone/);
  assert.equal(await readFile(settings, 'utf8'), '{ broken');
});

test('the app data folder matches what Electron uses on each platform', () => {
  assert.equal(appDataDir({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32', 'C:\\Users\\me'), 'C:\\Users\\me\\AppData\\Roaming');
  assert.equal(userDataDir({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32', 'C:\\Users\\me'), `C:\\Users\\me\\AppData\\Roaming\\${USER_DATA_FOLDER}`);
  assert.equal(userDataDir({}, 'darwin', '/Users/me'), `/Users/me/Library/Application Support/${USER_DATA_FOLDER}`);
  assert.equal(userDataDir({}, 'linux', '/home/me'), `/home/me/.config/${USER_DATA_FOLDER}`);
  assert.equal(userDataDir({ XDG_CONFIG_HOME: '/xdg' }, 'linux', '/home/me'), `/xdg/${USER_DATA_FOLDER}`);
  assert.equal(userDataDir({ DESKTOP_PET_USER_DATA: '/tmp/pet' }, 'linux', '/home/me'), '/tmp/pet');
});
