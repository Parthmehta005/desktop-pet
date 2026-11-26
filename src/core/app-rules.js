/**
 * App rules: map the foreground window to a mood.
 *
 * A rule matches on any combination of these fields; every field it names must match
 * (case-insensitive regular expressions):
 *
 *   process  Process name, without directory or ".exe" ("Spotify", "ms-teams")
 *   title    Window title ("Lo-fi beats - YouTube - Google Chrome")
 *   path     Full path of the executable ("D:\Steam\steamapps\common\Game\game.exe")
 *
 * `mood` is one of APP_RULE_MOODS. Rules are checked in order; the first match wins, so
 * put specific rules (YouTube Music) before general ones (YouTube).
 */

import { APP_RULE_MOODS } from './moods.js';

export const RULE_FIELDS = Object.freeze(['process', 'title', 'path']);
const MAX_PATTERN_LENGTH = 500;

export const DEFAULT_APP_RULES = Object.freeze([
  { name: 'Music apps', process: '^(spotify|tidal|deezer|musicbee|aimp|foobar2000|itunes|applemusic|amazon music)$', mood: 'vibing' },
  { name: 'Music in the browser', title: 'YouTube Music|Spotify|SoundCloud', mood: 'vibing' },
  { name: 'Zoom meetings', process: '^zoom$', title: 'meeting|webinar', mood: 'meeting' },
  { name: 'Teams calls', process: '^(ms-teams|teams)$', title: 'meeting|call', mood: 'meeting' },
  { name: 'Webex', process: '^(webex|ciscowebexstart|atmgr)$', mood: 'meeting' },
  { name: 'Google Meet', title: '^Meet - |Google Meet', mood: 'meeting' },
  { name: 'Steam, Epic and other store games', path: 'steamapps[\\\\/]common|[\\\\/]Epic Games[\\\\/]|[\\\\/]Riot Games[\\\\/]|[\\\\/]XboxGames[\\\\/]', mood: 'gaming' },
  { name: 'Minecraft', title: '^Minecraft', mood: 'gaming' },
  { name: 'Video players', process: '^(vlc|mpc-hc64|mpc-hc|mpc-be64|potplayermini64|potplayer|netflix)$', mood: 'watching' },
  { name: 'Video sites', title: 'YouTube|Netflix|Prime Video|Disney\\+|Twitch|Crunchyroll|Hulu', mood: 'watching' },
].map((rule) => Object.freeze(rule)));

/** Returns an error message for a rule that can't be used, or null if it's fine. */
export function validateRule(rule) {
  if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) return 'must be an object';
  if (!APP_RULE_MOODS.includes(rule.mood)) {
    return `mood must be one of ${APP_RULE_MOODS.join(', ')}`;
  }
  if (rule.name !== undefined && typeof rule.name !== 'string') return 'name must be text';
  const fields = RULE_FIELDS.filter((f) => rule[f] !== undefined && rule[f] !== '');
  if (fields.length === 0) return `needs at least one of ${RULE_FIELDS.join(', ')}`;
  for (const field of fields) {
    const pattern = rule[field];
    if (typeof pattern !== 'string') return `${field} must be text`;
    if (pattern.length > MAX_PATTERN_LENGTH) return `${field} is longer than ${MAX_PATTERN_LENGTH} characters`;
    try {
      new RegExp(pattern, 'i');
    } catch (err) {
      return `${field} is not a valid regular expression (${err.message})`;
    }
  }
  return null;
}

/**
 * Compiles rules for matching. Invalid rules are skipped and reported.
 * @returns {{ compiled: Array<{ mood: string, tests: Array<[string, RegExp]> }>, errors: Array<{ index: number, message: string }> }}
 */
export function compileRules(rules) {
  const compiled = [];
  const errors = [];
  (Array.isArray(rules) ? rules : []).forEach((rule, index) => {
    const message = validateRule(rule);
    if (message) {
      errors.push({ index, message });
      return;
    }
    const tests = RULE_FIELDS
      .filter((f) => rule[f] !== undefined && rule[f] !== '')
      .map((f) => [f, new RegExp(rule[f], 'i')]);
    compiled.push(Object.freeze({ mood: rule.mood, tests: Object.freeze(tests) }));
  });
  return { compiled: Object.freeze(compiled), errors };
}

/** "C:\Program Files\Spotify\Spotify.exe" -> "Spotify" */
export function processBaseName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '');
}

/**
 * The mood for a foreground window, or null if no rule matches.
 * @param {ReturnType<typeof compileRules>['compiled']} compiled
 * @param {{ process?: string, title?: string, path?: string }} app
 */
export function matchApp(compiled, app) {
  if (!app || typeof app !== 'object') return null;
  const values = {
    process: processBaseName(app.process),
    title: typeof app.title === 'string' ? app.title : '',
    path: typeof app.path === 'string' ? app.path : '',
  };
  for (const rule of compiled) {
    if (rule.tests.every(([field, re]) => re.test(values[field]))) return rule.mood;
  }
  return null;
}
