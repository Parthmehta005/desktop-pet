// The only bridge between the pet window and the main process. It runs sandboxed, so
// it's CommonJS and may only require 'electron'. Each function is named and narrow.
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('callback must be a function');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('desktopPet', Object.freeze({
  /** Resolves to { config }. */
  getConfig: () => ipcRenderer.invoke('pet:get-config'),
  /** Engine events from the main process (Claude hooks, idle, apps...). */
  onEvent: (callback) => subscribe('pet:event', callback),
  /** Changed settings, e.g. { pet: 'corgi' }. */
  onConfig: (callback) => subscribe('pet:config', callback),
  /** Whether the pointer is over the pet, so the window should catch clicks. */
  setInteractive: (over) => ipcRenderer.send('pet:interactive', over === true),
  /** The renderer has started. */
  ready: () => ipcRenderer.send('pet:ready'),
  /** The pet was clicked while panicking about the battery: open battery settings. */
  openBatterySettings: () => ipcRenderer.send('pet:open-battery-settings'),
}));
