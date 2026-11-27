// Windows only (CI's Windows job runs `node --test test/windows/foreground.test.js`): the real foreground
// and battery monitor script starts under the real PowerShell and prints both kinds of
// line. On failure it shows what PowerShell printed to stderr, e.g. C# compiler errors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SCRIPT_PATH, powerShellArgs, parseForegroundLine, parseBatteryLine } from '../../src/main/sources/app-monitor.js';

// On a fresh CI machine the first start took 13.4s; allow 30s.
test('the PowerShell monitor reports the foreground window and the battery within 30s', { timeout: 45_000 }, async () => {
  assert.equal(process.platform, 'win32', 'run this on Windows only');
  const child = spawn('powershell.exe', powerShellArgs(readFileSync(SCRIPT_PATH, 'utf8'), process.pid), {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  const started = Date.now();
  const lines = () => out.split(/\r?\n/).filter(Boolean);
  while (Date.now() - started < 30_000) {
    if (lines().some(parseForegroundLine) && lines().some(parseBatteryLine)) break;
    const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r(undefined), 200))]);
    if (code !== undefined) break;
  }
  child.kill();
  const app = lines().map(parseForegroundLine).find(Boolean);
  const battery = lines().map(parseBatteryLine).find(Boolean);
  console.log(`after ${Date.now() - started} ms: app ${JSON.stringify(app)}, battery ${JSON.stringify(battery)}`);
  const details = `\nstdout:\n${out.slice(0, 2000)}\nstderr:\n${err.slice(0, 4000)}`;
  assert.ok(app, `no foreground line${details}`);
  assert.ok(battery, `no battery line${details}`);
});
