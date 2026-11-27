// Adds the pet's hooks to Claude Code's settings.json, removes them, and reports status.
//
// Each installed hook is a one-line curl command that forwards the hook's JSON payload
// (stdin) to the pet's hook server and gives up after 2 seconds; `|| exit 0` keeps it
// quiet and non-blocking when the pet isn't running. The pet's entries are recognised by
// their URL path, so install/uninstall never touch anyone else's hooks.
//
// Safety rules: the original file is backed up before any change, writes are atomic, a
// second install with the same settings changes nothing, and a settings file that isn't
// valid JSON is left alone.
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { INSTALLED_HOOK_EVENTS } from '../core/claude-hooks.js';
import { HOOK_PATH } from './sources/hook-server.js';

/** Every command the pet installs contains this, and nothing else's should. */
export const HOOK_MARKER = HOOK_PATH;
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);
const HOOK_TIMEOUT_SECONDS = 5;

/** Where Claude Code keeps user settings (CLAUDE_CONFIG_DIR overrides ~/.claude). */
export function claudeSettingsPath(env = process.env, home = os.homedir()) {
  return path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'settings.json');
}

/**
 * The command Claude Code runs for each hook.
 * @param {{ port: number, token: string, shell?: 'windows' | 'posix', host?: string }} options
 *   shell 'windows' uses curl.exe (plain `curl` is an alias for something else in
 *   Windows PowerShell); 'posix' (Linux, macOS, WSL) uses curl.
 */
export function hookCommand({ port, token, shell = process.platform === 'win32' ? 'windows' : 'posix', host = '127.0.0.1' }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid hook port: ${port}`);
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) throw new Error('Invalid hook token');
  if (typeof host !== 'string' || !/^[A-Za-z0-9.-]{1,253}$/.test(host)) throw new Error(`Invalid hook host: ${host}`);
  if (shell !== 'windows' && shell !== 'posix') throw new Error(`Invalid shell: ${shell}`);
  const curl = shell === 'windows' ? 'curl.exe' : 'curl';
  return `${curl} -s -m 2 --connect-timeout 1 -X POST -H "Content-Type: application/json" `
    + `-H "X-Pet-Token: ${token}" --data-binary @- http://${host}:${port}${HOOK_PATH} || exit 0`;
}

/** settings.json text -> object. Missing or blank means {}. Throws on anything else. */
export function parseSettings(text) {
  if (text === null || text.trim() === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Claude Code's settings.json is not valid JSON, so it was left alone (${err.message}).`, { cause: err });
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error("Claude Code's settings.json is not a JSON object, so it was left alone.");
  }
  return parsed;
}

const isOurs = (entry) => typeof entry?.command === 'string' && entry.command.includes(HOOK_MARKER);

/** A copy of `settings` without the pet's hooks; tidies away what that leaves empty. */
export function removeHooks(settings) {
  const next = structuredClone(settings);
  if (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks)) return next;
  for (const [event, groups] of Object.entries(next.hooks)) {
    if (!Array.isArray(groups)) continue;
    const kept = [];
    for (const group of groups) {
      const entries = Array.isArray(group?.hooks) ? group.hooks : null;
      if (!entries || !entries.some(isOurs)) {
        kept.push(group);
        continue;
      }
      const remaining = entries.filter((e) => !isOurs(e));
      if (remaining.length) kept.push({ ...group, hooks: remaining });
    }
    if (kept.length) next.hooks[event] = kept;
    else delete next.hooks[event];
  }
  if (Object.keys(next.hooks).length === 0) delete next.hooks;
  return next;
}

/** A copy of `settings` with the pet's hooks (replacing any older ones of ours). */
export function addHooks(settings, command) {
  const next = removeHooks(settings);
  if (!next.hooks || typeof next.hooks !== 'object' || Array.isArray(next.hooks)) next.hooks = {};
  for (const event of INSTALLED_HOOK_EVENTS) {
    const groups = Array.isArray(next.hooks[event]) ? next.hooks[event] : [];
    const group = TOOL_EVENTS.has(event) ? { matcher: '*', hooks: [] } : { hooks: [] };
    group.hooks.push({ type: 'command', command, timeout: HOOK_TIMEOUT_SECONDS });
    next.hooks[event] = [...groups, group];
  }
  return next;
}

/**
 * 'installed'      every hook present with the expected command
 * 'outdated'       some of ours present, but not all, or for another port/token
 * 'not-installed'  none of ours
 */
export function hookStatus(settings, command) {
  const ours = [];
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      for (const entry of Array.isArray(group?.hooks) ? group.hooks : []) {
        if (isOurs(entry)) ours.push([event, entry.command]);
      }
    }
  }
  if (ours.length === 0) return 'not-installed';
  const complete = INSTALLED_HOOK_EVENTS.every((event) => ours.some(([e, c]) => e === event && c === command));
  return complete && ours.length === INSTALLED_HOOK_EVENTS.length ? 'installed' : 'outdated';
}

async function readOptional(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function timestamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

async function writeSettings(settingsPath, original, settings, now) {
  let backup = null;
  if (original !== null) {
    backup = `${settingsPath}.desktop-pet-backup-${timestamp(now)}`;
    await copyFile(settingsPath, backup);
  }
  await mkdir(path.dirname(settingsPath), { recursive: true });
  const tmp = `${settingsPath}.desktop-pet.tmp`;
  await writeFile(tmp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  await rename(tmp, settingsPath);
  return backup;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @returns {Promise<{ changed: boolean, settingsPath: string, backup: string | null }>}
 */
export async function installHooks({ settingsPath = claudeSettingsPath(), port, token, shell, host, now = new Date() }) {
  const command = hookCommand({ port, token, shell, host });
  const original = await readOptional(settingsPath);
  const settings = parseSettings(original);
  const next = addHooks(settings, command);
  if (original !== null && same(settings, next)) return { changed: false, settingsPath, backup: null };
  const backup = await writeSettings(settingsPath, original, next, now);
  return { changed: true, settingsPath, backup };
}

/**
 * @returns {Promise<{ changed: boolean, settingsPath: string, backup: string | null }>}
 */
export async function uninstallHooks({ settingsPath = claudeSettingsPath(), now = new Date() } = {}) {
  const original = await readOptional(settingsPath);
  if (original === null) return { changed: false, settingsPath, backup: null };
  const settings = parseSettings(original);
  const next = removeHooks(settings);
  if (same(settings, next)) return { changed: false, settingsPath, backup: null };
  const backup = await writeSettings(settingsPath, original, next, now);
  return { changed: true, settingsPath, backup };
}

/**
 * @returns {Promise<{ status: 'installed'|'outdated'|'not-installed'|'invalid-settings', settingsPath: string, error?: string }>}
 */
export async function readHookStatus({ settingsPath = claudeSettingsPath(), port, token, shell, host }) {
  const original = await readOptional(settingsPath);
  if (original === null) return { status: 'not-installed', settingsPath };
  let settings;
  try {
    settings = parseSettings(original);
  } catch (err) {
    return { status: 'invalid-settings', settingsPath, error: err.message };
  }
  let command;
  try {
    command = hookCommand({ port, token, shell, host });
  } catch {
    command = null;
  }
  return { status: hookStatus(settings, command), settingsPath };
}
