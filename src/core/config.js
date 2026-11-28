/**
 * The app's settings: schema, defaults, validation and version migration.
 *
 * This module is pure. Reading and writing config.json is the main process's job (M5);
 * it calls `parseConfig(text)` on load and `serializeConfig(config)` on save, and the
 * settings window calls `validateConfig()` before saving anything.
 */

import { PET_IDS } from './pets.js';
import { DEFAULT_APP_RULES, validateRule, RULE_FIELDS } from './app-rules.js';
import { canonicalPath } from './paths.js';
import { parseTimeOfDay } from './time.js';
import { parseShortcut, DEFAULT_TOGGLE_SHORTCUT } from './shortcuts.js';

export const CONFIG_VERSION = 1;

/**
 * Field types:
 *   boolean, integer, number (min/max), enum (values), time ("HH:MM", optionally null),
 *   folders (absolute paths, deduplicated), appRules (see app-rules.js), token,
 *   shortcut (a keyboard shortcut like "Ctrl+Alt+P", see shortcuts.js; optionally null).
 * `internal` fields are managed by the app and not shown in the settings window.
 */
export const CONFIG_SCHEMA = Object.freeze({
  pet: { type: 'enum', values: PET_IDS, default: 'cat' },
  shuffleDaily: { type: 'boolean', default: false },
  watchedFolders: { type: 'folders', max: 50, default: [] },
  reactToAllSessions: { type: 'boolean', default: false },
  idleMinutes: { type: 'integer', min: 1, max: 240, default: 5 },
  workingStaleMinutes: { type: 'integer', min: 1, max: 240, default: 10 },
  alertTimeoutMinutes: { type: 'integer', min: 1, max: 1440, default: 30 },
  breakReminderMinutes: { type: 'integer', min: 0, max: 480, default: 90 },
  breakMinutes: { type: 'integer', min: 1, max: 120, default: 5 },
  bedtime: { type: 'time', nullable: true, default: '00:30' },
  wakeTime: { type: 'time', default: '06:00' },
  petSize: { type: 'number', min: 0.5, max: 2, default: 1 },
  walkSpeed: { type: 'number', min: 0.25, max: 3, default: 1 },
  // Never fully see-through, so the pet can't vanish by accident (hiding is separate).
  petOpacity: { type: 'number', min: 0.2, max: 1, default: 1 },
  quietDuringMeetings: { type: 'boolean', default: true },
  hideWhenFullscreen: { type: 'boolean', default: true },
  lowBatteryPercent: { type: 'integer', min: 0, max: 50, default: 10 },
  appRules: { type: 'appRules', max: 100, default: DEFAULT_APP_RULES },
  launchAtLogin: { type: 'boolean', default: false },
  toggleShortcut: { type: 'shortcut', nullable: true, default: DEFAULT_TOGGLE_SHORTCUT },
  disableHardwareAcceleration: { type: 'boolean', default: false },
  hookPort: { type: 'integer', min: 1024, max: 65535, default: 47321 },
  hookToken: { type: 'token', internal: true, default: '' },
});

export const CONFIG_KEYS = Object.freeze(Object.keys(CONFIG_SCHEMA));

function copyRule(rule) {
  const out = { mood: rule.mood };
  if (typeof rule.name === 'string' && rule.name !== '') out.name = rule.name;
  for (const f of RULE_FIELDS) if (typeof rule[f] === 'string' && rule[f] !== '') out[f] = rule[f];
  return out;
}

function copyDefault(spec) {
  if (spec.type === 'appRules') return spec.default.map(copyRule);
  if (Array.isArray(spec.default)) return [...spec.default];
  return spec.default;
}

export function defaultConfig() {
  const config = { version: CONFIG_VERSION };
  for (const key of CONFIG_KEYS) config[key] = copyDefault(CONFIG_SCHEMA[key]);
  return config;
}

/**
 * Checks one value against its spec.
 * @returns {{ value: unknown, errors: string[] }}  `value` is undefined if it's unusable.
 */
function checkValue(spec, value) {
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean' ? { value, errors: [] } : { errors: ['must be true or false'] };
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { errors: ['must be a number'] };
      if (spec.type === 'integer' && !Number.isInteger(value)) return { errors: ['must be a whole number'] };
      if (value < spec.min || value > spec.max) return { errors: [`must be between ${spec.min} and ${spec.max}`] };
      return { value, errors: [] };
    }
    case 'enum':
      return spec.values.includes(value)
        ? { value, errors: [] }
        : { errors: [`must be one of ${spec.values.join(', ')}`] };
    case 'time':
      if (value === null && spec.nullable) return { value, errors: [] };
      return parseTimeOfDay(value) !== null
        ? { value, errors: [] }
        : { errors: [`must be a time like "00:30"${spec.nullable ? ' or null' : ''}`] };
    case 'token':
      return typeof value === 'string' && /^[A-Za-z0-9_-]{0,128}$/.test(value)
        ? { value, errors: [] }
        : { errors: ['must be up to 128 letters, digits, "-" or "_"'] };
    case 'shortcut': {
      if (value === null && spec.nullable) return { value, errors: [] };
      const parsed = parseShortcut(value);
      return parsed.shortcut ? { value: parsed.shortcut, errors: [] } : { errors: [parsed.error] };
    }
    case 'folders':
      return checkFolders(spec, value);
    case 'appRules':
      return checkRules(spec, value);
    default:
      return { errors: [`unknown type ${spec.type}`] };
  }
}

// Lists keep their valid entries; each bad entry is reported and dropped on its own.
function checkFolders(spec, value) {
  if (!Array.isArray(value)) return { errors: ['must be a list of folders'] };
  const errors = [];
  const seen = new Set();
  const out = [];
  value.forEach((folder, i) => {
    const canonical = canonicalPath(folder);
    if (canonical === null) {
      errors.push(`entry ${i + 1} is not an absolute folder path: ${JSON.stringify(folder)}`);
      return;
    }
    const id = `${canonical.kind}:${canonical.key}`;
    if (seen.has(id)) return; // duplicates are dropped quietly
    seen.add(id);
    out.push(folder.trim());
  });
  if (out.length > spec.max) {
    errors.push(`at most ${spec.max} folders; the rest were dropped`);
    out.length = spec.max;
  }
  return { value: out, errors };
}

function checkRules(spec, value) {
  if (!Array.isArray(value)) return { errors: ['must be a list of rules'] };
  const errors = [];
  const out = [];
  value.forEach((rule, i) => {
    const message = validateRule(rule);
    if (message) errors.push(`rule ${i + 1} ${message}`);
    else out.push(copyRule(rule));
  });
  if (out.length > spec.max) {
    errors.push(`at most ${spec.max} rules; the rest were dropped`);
    out.length = spec.max;
  }
  return { value: out, errors };
}

/**
 * Validates a whole config object. Missing keys get their default; unusable values are
 * replaced by the default and reported; unknown keys are dropped.
 *
 * @returns {{ config: object, errors: Array<{ key: string | null, message: string }>, dropped: string[] }}
 */
export function validateConfig(input) {
  const config = defaultConfig();
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { config, errors: [{ key: null, message: 'settings must be an object' }], dropped: [] };
  }
  const errors = [];
  for (const key of CONFIG_KEYS) {
    if (input[key] === undefined) continue;
    const result = checkValue(CONFIG_SCHEMA[key], input[key]);
    for (const message of result.errors) errors.push({ key, message });
    if (result.value !== undefined) config[key] = result.value;
  }
  const dropped = Object.keys(input).filter((k) => k !== 'version' && !(k in CONFIG_SCHEMA));
  return { config, errors, dropped };
}

/**
 * Upgrades an older config object to CONFIG_VERSION. Version 0 is any config written
 * before versioning (no `version` field); its keys are the same as version 1.
 */
const MIGRATIONS = {
  0: (c) => ({ ...c, version: 1 }),
};

export function migrateConfig(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { config: input, from: null, errors: [] };
  }
  const from = Number.isInteger(input.version) && input.version >= 0 ? input.version : 0;
  if (from > CONFIG_VERSION) {
    return {
      config: input,
      from,
      errors: [{ key: 'version', message: `settings are from a newer version (${from}); unknown settings will be ignored` }],
    };
  }
  let config = input;
  for (let v = from; v < CONFIG_VERSION; v++) config = MIGRATIONS[v](config);
  return { config, from, errors: [] };
}

/**
 * config.json text -> usable config. Never throws: corrupt or invalid input falls back
 * to defaults, and the caller can tell from `corrupt` whether to set the file aside.
 *
 * @returns {{ config: object, errors: Array<{ key: string | null, message: string }>, dropped: string[], corrupt: boolean, from: number | null }}
 */
export function parseConfig(text) {
  let raw;
  try {
    // Notepad and other Windows editors may save a byte-order mark: that's not corruption.
    raw = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (err) {
    return {
      config: defaultConfig(),
      errors: [{ key: null, message: `settings file is not valid JSON (${err.message})` }],
      dropped: [],
      corrupt: true,
      from: null,
    };
  }
  const migrated = migrateConfig(raw);
  const validated = validateConfig(migrated.config);
  return {
    config: validated.config,
    errors: [...migrated.errors, ...validated.errors],
    dropped: validated.dropped,
    corrupt: validated.errors.some((e) => e.key === null),
    from: migrated.from,
  };
}

export function serializeConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}
