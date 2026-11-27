// Starts and stops the local activity sources and routes their events into the bus:
//   files  edits in watched folders          -> 'file-activity' (source 'files')
//          commits in their repos            -> 'commit'        (source 'git')
//   idle   keyboard/mouse idle time, locking -> 'idle-time', 'lock', 'unlock' (source 'idle')
//   apps   the foreground window (Windows)   -> 'app'           (source 'apps')
//          and the battery (Windows)         -> 'battery'       (source 'battery', via onBattery)
// The Claude Code hook server is started separately (main.js).
import { createRepoWatcher } from './repo-watcher.js';
import { createIdleMonitor } from './idle-monitor.js';
import { createAppMonitor } from './app-monitor.js';

export const SOURCE_NAMES = Object.freeze(['files', 'idle', 'apps']);

/**
 * Which sources to run. DESKTOP_PET_SOURCES (comma-separated) narrows it; tests use it
 * so real idle time or foreground windows can't change the pet mid-test.
 */
export function enabledSources(value) {
  if (value === undefined || value === null) return new Set(SOURCE_NAMES);
  return new Set(String(value).split(',').map((s) => s.trim()).filter((s) => SOURCE_NAMES.includes(s)));
}

/**
 * @param {object} options
 * @param {{ emit(event: object, options: { source: string }): boolean }} options.bus
 * @param {object} options.powerMonitor  Electron's powerMonitor.
 * @param {Set<string>} [options.enabled]
 * @param {(event: object) => void} [options.onBattery]  Battery reports; the main process
 *   passes them to the bus itself (they also decide whether a hidden pet comes back).
 * @param {(err: Error) => void} [options.onError]  Problems with the foreground monitor.
 */
export function createSources({ bus, powerMonitor, enabled = new Set(SOURCE_NAMES), onBattery, onError }) {
  const repo = enabled.has('files')
    ? createRepoWatcher({
      onActivity: (folder) => bus.emit({ type: 'file-activity', folder }, { source: 'files' }),
      onCommit: (folder) => bus.emit({ type: 'commit', folder }, { source: 'git' }),
    })
    : null;
  const idle = enabled.has('idle')
    ? createIdleMonitor({ powerMonitor, emit: (event) => bus.emit(event, { source: 'idle' }) })
    : null;
  const apps = enabled.has('apps')
    ? createAppMonitor({
      emit: (event) => bus.emit(event, { source: 'apps' }),
      emitBattery: onBattery ?? ((event) => bus.emit(event, { source: 'battery' })),
      ...(onError ? { onError } : {}),
    })
    : null;

  return {
    repo,
    idle,
    apps,
    async start(config) {
      await repo?.setFolders(config.watchedFolders);
      idle?.start();
      apps?.start();
    },
    /** Applies settings changes that affect sources (watched folders). */
    async applyConfig(changes, config) {
      if ('watchedFolders' in changes) await repo?.setFolders(config.watchedFolders);
    },
    async stop() {
      idle?.stop();
      apps?.stop();
      await repo?.close();
    },
  };
}
