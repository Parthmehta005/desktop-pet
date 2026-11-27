// Watches your repos: file edits make the pet `focused`.
//
// For each watched folder it watches files, skipping tool output (see repo-rules.js).
import { watch as chokidarWatch } from 'chokidar';
import { isIgnoredPath } from './repo-rules.js';

/** A burst of edits is reported at most this often per folder. */
export const ACTIVITY_THROTTLE_MS = 5000;
/** How deep inside a watched folder edits are noticed. */
export const MAX_DEPTH = 12;

/**
 * @param {object} options
 * @param {(folder: string) => void} options.onActivity  Files changed in a watched folder.
 */
export function createRepoWatcher({
  onActivity,
  watch = chokidarWatch,
  now = Date.now,
  throttleMs = ACTIVITY_THROTTLE_MS,
  onError = (err) => console.warn('Desktop Pet: repo watcher:', err.message),
}) {
  /** folder -> { watchers: FSWatcher[], ready: Promise } */
  const watched = new Map();

  function whenReady(watcher) {
    return new Promise((resolve) => watcher.once('ready', resolve));
  }

  function watchFiles(folder) {
    let lastActivity = -Infinity;
    const watcher = watch(folder, {
      ignored: (p) => isIgnoredPath(p, folder),
      ignoreInitial: true,
      followSymlinks: false,
      depth: MAX_DEPTH,
    });
    watcher.on('all', (event) => {
      if (!['add', 'change', 'unlink'].includes(event)) return;
      const t = now();
      if (t - lastActivity < throttleMs) return;
      lastActivity = t;
      onActivity(folder);
    });
    watcher.on('error', onError);
    return watcher;
  }

  async function add(folder) {
    const files = watchFiles(folder);
    watched.set(folder, { watchers: [files], ready: whenReady(files) });
  }

  async function remove(folder) {
    const entry = watched.get(folder);
    watched.delete(folder);
    await Promise.all(entry.watchers.map((w) => w.close()));
  }

  return {
    /** Watches exactly these folders, starting and stopping watchers as needed. */
    async setFolders(folders) {
      const wanted = new Set(folders);
      for (const folder of [...watched.keys()]) if (!wanted.has(folder)) await remove(folder);
      for (const folder of wanted) if (!watched.has(folder)) await add(folder);
    },
    /** Resolves when every watcher has finished its initial scan. */
    async whenReady() {
      await Promise.all([...watched.values()].map((w) => w.ready));
    },
    get folders() {
      return [...watched.keys()];
    },
    async close() {
      for (const folder of [...watched.keys()]) await remove(folder);
    },
  };
}
