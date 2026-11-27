// config.json in the app's data folder: load (with repair), validated updates, and
// atomic writes. Node only, no Electron, so it can be unit tested with a temp folder.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import {
  parseConfig, validateConfig, serializeConfig, defaultConfig, CONFIG_VERSION,
} from '../core/config.js';

export const CONFIG_FILE = 'config.json';

export function createConfigStore(dir) {
  const file = path.join(dir, CONFIG_FILE);
  const tmp = `${file}.tmp`;
  let current = defaultConfig();
  let queue = Promise.resolve();

  function writeSync(config) {
    writeFileSync(tmp, serializeConfig(config), 'utf8');
    renameSync(tmp, file);
  }

  /**
   * Loads config.json. Synchronous on purpose: some settings (hardware acceleration)
   * must be applied before Electron finishes starting.
   *
   * - No file: writes the defaults.
   * - Not valid JSON: moves it aside to config.corrupt-<time>.json and writes defaults.
   * - Older version: migrates and rewrites it.
   * - Bad values: uses defaults for them and reports them, but leaves the file alone so
   *   a hand edit can be fixed.
   */
  function load() {
    mkdirSync(dir, { recursive: true });
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      current = defaultConfig();
      writeSync(current);
      return { config: current, created: true, movedAside: null, errors: [], dropped: [] };
    }
    const parsed = parseConfig(text);
    let movedAside = null;
    if (parsed.corrupt) {
      movedAside = path.join(dir, `config.corrupt-${Date.now()}.json`);
      renameSync(file, movedAside);
      writeSync(parsed.config);
    } else if (parsed.from !== null && parsed.from < CONFIG_VERSION) {
      writeSync(parsed.config);
    }
    current = parsed.config;
    return { config: current, created: false, movedAside, errors: parsed.errors, dropped: parsed.dropped };
  }

  /**
   * Applies changes if the result is valid, and saves it. Invalid changes are rejected
   * whole, with the reasons. Updates run one at a time.
   *
   * @returns {Promise<{ ok: boolean, config: object, errors: Array<{ key: string|null, message: string }> }>}
   */
  function update(changes) {
    const run = async () => {
      const { config, errors } = validateConfig({ ...current, ...changes });
      if (errors.length) return { ok: false, config: current, errors };
      // Only report the new settings once they're safely on disk: quitting straight
      // after a change (or a crash) must not leave the app and the file disagreeing.
      await writeFile(tmp, serializeConfig(config), 'utf8');
      await rename(tmp, file);
      current = config;
      return { ok: true, config: current, errors: [] };
    };
    queue = queue.then(run, run);
    return queue;
  }

  return {
    file,
    load,
    update,
    get config() {
      return current;
    },
  };
}
