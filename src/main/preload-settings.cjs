// The settings window's bridge to the main process. Sandboxed, so CommonJS; each
// function is named and narrow, and the main process checks every call comes from the
// settings window and validates what it's given.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petSettings', Object.freeze({
  /** Resolves to { config, hooks: { status, settingsPath, serverError } }. */
  getState: () => ipcRenderer.invoke('settings:get-state'),
  /** Saves changed settings. Resolves to { ok, errors, state }. */
  save: (changes) => ipcRenderer.invoke('settings:save', changes),
  /** Opens a folder picker. Resolves to the chosen folder, or null. */
  pickFolder: () => ipcRenderer.invoke('settings:pick-folder'),
  /** Resolve to { ok, message, state }. */
  installHooks: () => ipcRenderer.invoke('settings:install-hooks'),
  uninstallHooks: () => ipcRenderer.invoke('settings:uninstall-hooks'),
  /** Called when settings change elsewhere (e.g. from the tray). */
  onState: (callback) => {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('settings:state', listener);
    return () => ipcRenderer.removeListener('settings:state', listener);
  },
}));
