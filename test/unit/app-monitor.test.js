import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { readFile } from 'node:fs/promises';
import {
  createAppMonitor, parseForegroundLine, parseBatteryLine, powerShellArgs, SCRIPT_PATH, RESTART_DELAYS,
} from '../../src/main/sources/app-monitor.js';

/** A pretend PowerShell process. */
function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.killed = false;
  child.kill = () => { child.killed = true; child.emit('exit', null, 'SIGTERM'); };
  child.say = (line) => child.stdout.write(`${line}\n`);
  return child;
}

function harness() {
  const spawned = [];
  const events = [];
  const batteries = [];
  const timers = [];
  const monitor = createAppMonitor({
    emit: (e) => events.push(e),
    emitBattery: (e) => batteries.push(e),
    platform: 'win32',
    spawn: (cmd, args, opts) => { const c = fakeChild(); c.cmd = cmd; c.args = args; c.opts = opts; spawned.push(c); return c; },
    readScript: () => 'Write-Output "hi"',
    parentPid: 4242,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
    onError: () => {},
  });
  const flush = () => new Promise((r) => setImmediate(r));
  return { monitor, spawned, events, batteries, timers, flush };
}

const LINE = (o) => JSON.stringify({ process: 'Spotify', title: 'Spotify Premium', path: 'C:\\Spotify\\Spotify.exe', fullscreen: false, ...o });

test('parseForegroundLine reads monitor output and rejects junk', () => {
  assert.deepEqual(parseForegroundLine(LINE()), { process: 'Spotify', title: 'Spotify Premium', path: 'C:\\Spotify\\Spotify.exe', fullscreen: false });
  assert.equal(parseForegroundLine(LINE({ fullscreen: 'yes' })).fullscreen, false);
  assert.equal(parseForegroundLine(LINE({ path: null })).path, '');
  assert.equal(parseForegroundLine(LINE({ title: 'x'.repeat(5000) })).title.length, 1000);
  for (const junk of ['', 'hello', '[1]', 'null', '{"title":"no process"}', 'Exception calling "GetWindowText"']) {
    assert.equal(parseForegroundLine(junk), null, junk);
  }
});

test('the PowerShell runs hidden, without a profile, with the parent pid baked in', () => {
  const args = powerShellArgs('Write-Output 1', 4242);
  assert.deepEqual(args.slice(0, 5), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']);
  const script = Buffer.from(args[5], 'base64').toString('utf16le');
  assert.equal(script, '$ParentPid = 4242\nWrite-Output 1');
});

test('recorded output becomes app events; garbage lines are skipped', async () => {
  const h = harness();
  assert.equal(h.monitor.start(), true);
  const [child] = h.spawned;
  assert.equal(child.cmd, 'powershell.exe');
  assert.equal(child.opts.windowsHide, true);
  child.say(LINE());
  child.say('WARNING: something odd');
  child.say(LINE({ process: 'Zoom', title: 'Zoom Meeting' }));
  await h.flush();
  assert.deepEqual(h.events.map((e) => [e.type, e.process]), [['app', 'Spotify'], ['app', 'Zoom']]);
});

test('a crashed monitor restarts with growing delays, and a good line resets them', async () => {
  const h = harness();
  h.monitor.start();
  h.spawned[0].emit('exit', 1);
  assert.equal(h.timers.at(-1).ms, RESTART_DELAYS[0]);
  h.timers.at(-1).fn();
  h.spawned[1].emit('exit', 1);
  assert.equal(h.timers.at(-1).ms, RESTART_DELAYS[1]);
  h.timers.at(-1).fn();
  h.spawned[2].emit('exit', 1);
  assert.equal(h.timers.at(-1).ms, RESTART_DELAYS[2]);
  h.timers.at(-1).fn();
  h.spawned[3].emit('exit', 1);
  assert.equal(h.timers.at(-1).ms, RESTART_DELAYS[2], 'caps at the last delay');
  h.timers.at(-1).fn();
  h.spawned[4].say(LINE());
  await h.flush();
  h.spawned[4].emit('exit', 1);
  assert.equal(h.timers.at(-1).ms, RESTART_DELAYS[0], 'working output resets the backoff');
});

test('a spawn error (no PowerShell) is reported and retried, not thrown', () => {
  const h = harness();
  h.monitor.start();
  h.spawned[0].emit('error', new Error('spawn powershell.exe ENOENT'));
  h.spawned[0].emit('exit', null); // must not schedule a second restart
  assert.equal(h.timers.length, 1);
});

test('stop kills the process and nothing restarts', () => {
  const h = harness();
  h.monitor.start();
  assert.equal(h.monitor.running, true);
  h.monitor.stop();
  assert.equal(h.spawned[0].killed, true);
  assert.equal(h.timers.length, 0);
  assert.equal(h.monitor.running, false);
});

test('off Windows it does nothing and starts no process', () => {
  for (const platform of ['linux', 'darwin']) {
    let spawned = 0;
    const monitor = createAppMonitor({ emit: () => {}, platform, spawn: () => { spawned++; return fakeChild(); } });
    assert.equal(monitor.start(), false);
    assert.equal(spawned, 0);
    assert.equal(monitor.running, false);
  }
});

test('the real script needs no admin rights or network, polls at most once a second, and exits with the pet', async () => {
  const script = await readFile(SCRIPT_PATH, 'utf8');
  assert.match(script, /Start-Sleep -Milliseconds 1000/);
  assert.match(script, /\$ParentPid/);
  assert.match(script, /ConvertTo-Json -Compress/);
  for (const banned of [/Invoke-WebRequest/i, /Invoke-RestMethod/i, /Net\.WebClient/i, /Start-Process/i, /RunAs/i, /Set-ExecutionPolicy/i, /New-Object\s+System\.Net/i]) {
    assert.doesNotMatch(script, banned);
  }
});

const BATTERY = (o) => JSON.stringify({ battery: { percent: 7, charging: false, present: true, ...o } });

test('parseBatteryLine reads battery lines and rejects everything else', () => {
  assert.deepEqual(parseBatteryLine(BATTERY()), { type: 'battery', percent: 7, charging: false, present: true });
  assert.deepEqual(parseBatteryLine(BATTERY({ percent: 100, charging: true })), { type: 'battery', percent: 100, charging: true, present: true });
  assert.equal(parseBatteryLine(BATTERY({ present: false })).present, false, 'a PC without a battery');
  assert.equal(parseBatteryLine(BATTERY({ percent: 300 })).percent, 100);
  for (const junk of ['', 'hello', LINE(), '{"battery":null}', '{"battery":[1]}', BATTERY({ percent: 'low' }),
    BATTERY({ charging: 'yes' }), BATTERY({ present: undefined })]) {
    assert.equal(parseBatteryLine(junk), null, junk);
  }
});

test('recorded output: battery lines become battery events, app lines app events', async () => {
  const h = harness();
  h.monitor.start();
  const [child] = h.spawned;
  child.say(LINE());
  child.say(BATTERY({ percent: 9 }));
  child.say(BATTERY({ percent: 9, charging: true }));
  child.say('{"battery":"garbage"}');
  await h.flush();
  assert.deepEqual(h.events.map((e) => e.process), ['Spotify']);
  assert.deepEqual(h.batteries, [
    { type: 'battery', percent: 9, charging: false, present: true },
    { type: 'battery', percent: 9, charging: true, present: true },
  ]);
});

test('the real script reports the battery with GetSystemPowerStatus, only when it changes', async () => {
  const script = await readFile(SCRIPT_PATH, 'utf8');
  assert.match(script, /GetSystemPowerStatus/);
  assert.match(script, /\$battery -ne \$lastBattery/);
  // The C# line-building expression is also valid JavaScript: run the script's own
  // expression and check the parser reads what it builds.
  const expr = script.match(/return ("\{\\"battery.*);\s*$/m)[1];
  const build = new Function('percent', 'charging', 'present', `return ${expr};`);
  assert.deepEqual(parseBatteryLine(build(7, false, true)), { type: 'battery', percent: 7, charging: false, present: true });
  assert.deepEqual(parseBatteryLine(build(100, true, false)), { type: 'battery', percent: 100, charging: true, present: false });
});

test('when PowerShell gives up, what it said on stderr is reported', async () => {
  const errors = [];
  const children = [];
  const monitor = createAppMonitor({
    emit: () => {},
    platform: 'win32',
    spawn: () => {
      const c = fakeChild();
      c.stderr = new PassThrough();
      children.push(c);
      return c;
    },
    readScript: () => '',
    setTimer: () => 1,
    clearTimer: () => {},
    onError: (err) => errors.push(err.message),
  });
  monitor.start();
  const [child] = children;
  child.stderr.write('Add-Type : c:\\temp\\x.cs(31) : Operator cannot be applied\r\n');
  child.stderr.write('Cannot add type. Compilation errors occurred.\r\n');
  await new Promise((r) => setImmediate(r));
  child.emit('exit', 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /PowerShell stopped with exit code 1: Add-Type .*Operator cannot be applied \| Cannot add type/);
  monitor.stop();
});
