// End to end: install the hooks with the real command-line tool, then run the exact
// commands it installed through a real shell, the way Claude Code runs them, with
// payloads shaped like Claude Code's. The pet in the running app must react.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchWithHooks, ROOT } from './helpers.js';

/** Runs `command` in the system shell with `input` on stdin. */
function runHook(command, input) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr, ms: Date.now() - started }));
    child.stdin.end(JSON.stringify(input));
  });
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/hooks.js', ...args], { cwd: ROOT });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('the installed hook commands drive the pet through a whole Claude turn', async () => {
  const { app, page, userData, claudeDir } = await launchWithHooks();
  const settingsPath = path.join(claudeDir, 'settings.json');
  try {
    const install = await runCli(['install', '--settings', settingsPath, '--user-data', userData]);
    expect(install.code, install.out).toBe(0);
    const { hooks } = JSON.parse(await readFile(settingsPath, 'utf8'));
    const commandFor = (event) => hooks[event][0].hooks[0].command;

    const payload = (event, extra = {}) => ({
      session_id: 'e2e-session',
      transcript_path: path.join(claudeDir, 'projects', 'x', 'e2e-session.jsonl'),
      cwd: ROOT,
      hook_event_name: event,
      ...extra,
    });

    const steps = [
      ['SessionStart', payload('SessionStart', { source: 'startup' }), null],
      ['UserPromptSubmit', payload('UserPromptSubmit', { prompt: 'make the tests pass' }), 'working'],
      ['PreToolUse', payload('PreToolUse', { tool_name: 'Bash', tool_input: { command: 'npm test' } }), 'working'],
      ['Notification', payload('Notification', { notification_type: 'permission_prompt', message: 'Claude needs your permission to use Bash' }), 'alert'],
      ['PostToolUse', payload('PostToolUse', { tool_name: 'Bash', tool_response: { stdout: 'ok' } }), 'working'],
      ['Stop', payload('Stop', { stop_hook_active: false }), 'happy'],
    ];
    for (const [event, input, expected] of steps) {
      const result = await runHook(commandFor(event), input);
      expect(result.code, `${event} exit code (${result.stderr})`).toBe(0);
      expect(result.stdout, `${event} must print nothing (it could reach Claude's context)`).toBe('');
      if (expected) await expect(page.locator('.pet-view'), event).toHaveAttribute('data-state', expected);
    }

    await runHook(commandFor('SessionEnd'), payload('SessionEnd', { reason: 'exit' }));
    await expect.poll(() => page.evaluate(() => window.__pet.controller.snapshot().claude.working)).toBe(0);
  } finally {
    await app.close();
  }
});

test('with the pet not running, a hook exits at once, quietly and successfully', async () => {
  const { app, userData, claudeDir } = await launchWithHooks();
  const settingsPath = path.join(claudeDir, 'settings.json');
  await runCli(['install', '--settings', settingsPath, '--user-data', userData]);
  await app.close();
  const { hooks } = JSON.parse(await readFile(settingsPath, 'utf8'));
  const result = await runHook(hooks.Stop[0].hooks[0].command, { hook_event_name: 'Stop', session_id: 'x', cwd: ROOT });
  expect(result.code).toBe(0);
  expect(result.stdout).toBe('');
  expect(result.ms, 'it gives up quickly instead of blocking Claude').toBeLessThan(3000);
});
