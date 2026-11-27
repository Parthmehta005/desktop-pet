// Electron main process: app lifecycle, the pet window and its IPC.
import { app, ipcMain, dialog, powerMonitor } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPetWindow, PET_WINDOW_OPTIONS } from './pet-window.js';
import { registerAppScheme, handleAppProtocol, hardenApp, secureWebPreferences } from './security.js';
import { rendererUrl } from './app-paths.js';
import { createConfigStore } from './config-store.js';
import { USER_DATA_FOLDER } from './user-data.js';
import { createEventBus } from './event-bus.js';
import { createTray } from './tray.js';
import { buildTrayMenu, TEST_REACTIONS } from './tray-menu.js';
import { PETS } from '../core/pets.js';
import { createHookServer } from './sources/hook-server.js';
import { createSources, enabledSources } from './sources/index.js';
import { hookToEvent } from '../core/claude-hooks.js';
import { installHooks, uninstallHooks, readHookStatus, claudeSettingsPath } from './hooks-installer.js';

// Settings live in <appData>/desktop-pet (the hooks command-line tool looks there too).
// Tests, or anyone who wants a separate profile, can point at another folder.
app.setPath('userData', process.env.DESKTOP_PET_USER_DATA || path.join(app.getPath('appData'), USER_DATA_FOLDER));
const testing = process.env.DESKTOP_PET_TEST === '1';
// The pet never needs the internet: stop Chromium's background update checks.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const PRELOAD = fileURLToPath(new URL('./preload.cjs', import.meta.url));

const state = {
  petWindow: null,
  store: null,
  bus: null,
  tray: null,
  hookServer: null,
  // File, git, idle and foreground-app watching (see sources/index.js).
  sources: null,
  // Whether Claude Code hooks can reach the pet: { listening, port, error }.
  hooks: { listening: false, port: null, error: null },
  // Whether the hooks are in Claude Code's settings: { status, settingsPath, error }.
  hookInstall: { status: 'unknown', settingsPath: null, error: null },
};

/** Sends an engine event to the pet. */
function sendToPet(event) {
  const win = state.petWindow?.win;
  if (win && !win.isDestroyed()) win.webContents.send('pet:event', event);
}

/** Only the pet window's own page may use the pet IPC channels. */
function fromPetWindow(event) {
  const win = state.petWindow?.win;
  return Boolean(win && !win.isDestroyed() && event.sender === win.webContents);
}

/**
 * Changes settings: saves them, then tells the pet. Rejects invalid changes whole.
 * @returns {Promise<{ ok: boolean, errors: Array<{ key: string|null, message: string }> }>}
 */
async function setConfig(changes) {
  const result = await state.store.update(changes);
  if (!result.ok) return { ok: false, errors: result.errors };
  const win = state.petWindow?.win;
  if (win && !win.isDestroyed()) win.webContents.send('pet:config', changes);
  if ('petSize' in changes) state.petWindow.setPetSize(result.config.petSize);
  if ('hookPort' in changes) await startHookServer();
  await state.sources?.applyConfig(changes, result.config);
  return { ok: true, errors: [] };
}

/** Starts (or restarts) the local server the Claude Code hook command posts to. */
async function startHookServer() {
  await state.hookServer?.stop();
  const port = state.store.config.hookPort;
  state.hookServer = createHookServer({
    getToken: () => state.store.config.hookToken,
    onHook(payload) {
      const result = hookToEvent(payload, state.store.config);
      if (result.event) state.bus.emit(result.event, { source: 'claude' });
    },
  });
  try {
    await state.hookServer.start(port);
    state.hooks = { listening: true, port, error: null };
  } catch (err) {
    const error = err.code === 'EADDRINUSE'
      ? `Port ${port} is already in use by another program. Pick another port in settings.`
      : `Could not listen on port ${port}: ${err.message}`;
    state.hooks = { listening: false, port, error };
    console.warn(`Desktop Pet: ${error}`);
  }
  state.tray?.refresh();
}

/** The hook command authenticates with this; it's made once and kept in config.json. */
async function ensureHookToken() {
  if (state.store.config.hookToken) return;
  await state.store.update({ hookToken: randomBytes(24).toString('hex') });
}

/** Re-reads whether the hooks are installed in Claude Code's settings. */
async function refreshHookStatus() {
  const { hookPort: port, hookToken: token } = state.store.config;
  try {
    const result = await readHookStatus({ settingsPath: claudeSettingsPath(), port, token });
    state.hookInstall = { status: result.status, settingsPath: result.settingsPath, error: result.error ?? null };
  } catch (err) {
    state.hookInstall = { status: 'invalid-settings', settingsPath: claudeSettingsPath(), error: err.message };
  }
  state.tray?.refresh();
  return state.hookInstall;
}

/** Tells the user how a tray action went (skipped in tests: dialogs would block). */
function notify(type, message, detail) {
  if (!testing) dialog.showMessageBox({ type, title: 'Desktop Pet', message, detail });
}

/** What the tray menu can do. */
const actions = {
  async setPet(id) {
    await setConfig({ pet: id });
    state.tray?.refresh();
  },
  setPaused(paused) {
    state.bus.setPaused(paused);
    state.tray?.refresh();
  },
  test(id) {
    const reaction = TEST_REACTIONS.find((r) => r.id === id);
    for (const event of reaction?.events ?? []) state.bus.emit(event, { source: 'test' });
  },
  async installHooks() {
    const { hookPort: port, hookToken: token } = state.store.config;
    try {
      const result = await installHooks({ settingsPath: claudeSettingsPath(), port, token });
      await refreshHookStatus();
      notify('info', 'Claude Code hooks installed',
        `Saved to ${result.settingsPath}.${result.backup ? `\nThe previous file was backed up to ${result.backup}.` : ''}\n\nStart a new Claude Code session (or restart open ones) and the pet will react.`);
      return { ok: true, ...result };
    } catch (err) {
      await refreshHookStatus();
      notify('error', "Couldn't install the Claude Code hooks", err.message);
      return { ok: false, error: err.message };
    }
  },
  async uninstallHooks() {
    try {
      const result = await uninstallHooks({ settingsPath: claudeSettingsPath() });
      await refreshHookStatus();
      notify('info', 'Claude Code hooks removed',
        result.changed ? `Removed from ${result.settingsPath}.\nThe previous file was backed up to ${result.backup}.` : 'There were none to remove.');
      return { ok: true, ...result };
    } catch (err) {
      await refreshHookStatus();
      notify('error', "Couldn't remove the Claude Code hooks", err.message);
      return { ok: false, error: err.message };
    }
  },
  quit() {
    app.quit();
  },
};

const trayState = () => ({
  config: state.store.config,
  paused: state.bus.paused,
  pets: PETS,
  hooks: { status: state.hookInstall.status, serverError: state.hooks.error },
});

function registerIpc() {
  ipcMain.handle('pet:get-config', (event) => {
    if (!fromPetWindow(event)) throw new Error('not allowed');
    return { config: state.store.config };
  });
  ipcMain.on('pet:ready', () => {});
  ipcMain.on('pet:interactive', (event, over) => {
    if (!fromPetWindow(event) || typeof over !== 'boolean') return;
    state.petWindow.setInteractive(over);
  });
}

async function start() {
  hardenApp();
  handleAppProtocol();
  registerIpc();
  state.petWindow = createPetWindow({
    petSize: state.store.config.petSize,
    webPreferences: secureWebPreferences(PRELOAD),
  });
  await state.petWindow.win.loadURL(rendererUrl('pet.html'));
  state.tray = createTray({ getState: trayState, actions });
  await ensureHookToken();
  await startHookServer();
  await refreshHookStatus();
  state.sources = createSources({
    bus: state.bus,
    powerMonitor,
    enabled: enabledSources(process.env.DESKTOP_PET_SOURCES),
  });
  await state.sources.start(state.store.config);
}

registerAppScheme();
const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
  // The pet is already running; one pet is plenty.
  app.quit();
} else {
  state.bus = createEventBus(sendToPet);
  state.store = createConfigStore(app.getPath('userData'));
  const loaded = state.store.load();
  if (loaded.movedAside) console.warn(`Settings file was unreadable; moved it to ${loaded.movedAside} and started fresh.`);
  for (const { key, message } of loaded.errors) console.warn(`Setting ${key ?? ''}: ${message}`);
  if (state.store.config.disableHardwareAcceleration) app.disableHardwareAcceleration();

  app.on('second-instance', () => {
    // Nothing to bring to the front: the pet is always on top already.
  });
  // The pet lives in the tray, so closing windows doesn't quit the app.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    state.tray?.destroy();
    state.hookServer?.stop();
    state.sources?.stop();
  });
  app.whenReady().then(start).catch((err) => {
    console.error('Desktop Pet failed to start:', err);
    app.exit(1);
  });
}

// Tests reach in through this; it is only set when DESKTOP_PET_TEST=1.
if (testing) {
  globalThis.__desktopPet = {
    state,
    actions,
    PET_WINDOW_OPTIONS,
    sendToPet,
    setConfig,
    trayMenu: () => buildTrayMenu(trayState(), actions),
    refreshHookStatus,
  };
}
