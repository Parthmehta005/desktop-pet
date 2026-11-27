// Electron main process: app lifecycle, the pet window and its IPC.
import { app, ipcMain, dialog, powerMonitor } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPetWindow, PET_WINDOW_OPTIONS } from './pet-window.js';
import { createSettingsWindow } from './settings-window.js';
import { registerAppScheme, handleAppProtocol, hardenApp, secureWebPreferences } from './security.js';
import { rendererUrl } from './app-paths.js';
import { createConfigStore } from './config-store.js';
import { USER_DATA_FOLDER } from './user-data.js';
import { createEventBus } from './event-bus.js';
import { createTray } from './tray.js';
import { buildTrayMenu, TEST_REACTIONS } from './tray-menu.js';
import { PETS, petForDay } from '../core/pets.js';
import { CONFIG_KEYS, CONFIG_SCHEMA } from '../core/config.js';
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
const SETTINGS_PRELOAD = fileURLToPath(new URL('./preload-settings.cjs', import.meta.url));
/** Settings the settings window may change (not internal ones like the hook token). */
const USER_KEYS = new Set(CONFIG_KEYS.filter((key) => !CONFIG_SCHEMA[key].internal));

const state = {
  petWindow: null,
  settings: null,
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
  // Tests can't click through a native folder picker; in test mode they queue answers here.
  testFolderPicks: [],
  // In test mode, launch-at-login changes are recorded here instead of applied.
  loginItemCalls: [],
  // In test mode, settings saves can be slowed down to show races (a slow disk).
  testSaveDelayMs: 0,
  shuffleTimer: null,
};

/**
 * Starts the pet when you sign in (Windows and macOS; a no-op elsewhere). The portable
 * .exe unpacks itself into a new temporary folder on every run, so Windows must be
 * pointed at the .exe itself, not at the copy that is running.
 */
function applyLoginItem(openAtLogin) {
  const portable = process.env.PORTABLE_EXECUTABLE_FILE;
  const settings = portable ? { openAtLogin, path: portable } : { openAtLogin };
  if (testing) state.loginItemCalls.push(settings);
  else app.setLoginItemSettings(settings);
}

/** "A different pet every day": switches to today's pet if it isn't showing already. */
async function checkShuffle(now = new Date()) {
  if (!state.store.config.shuffleDaily) return;
  const pet = petForDay(now);
  if (pet !== state.store.config.pet) await setConfig({ pet });
}

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

/** Only the settings window's own page may use the settings IPC channels. */
function fromSettingsWindow(event) {
  const win = state.settings?.window;
  return Boolean(win && event.sender === win.webContents);
}

/** What the settings window shows: the config (minus the hook token) and hook status. */
function settingsState() {
  const config = { ...state.store.config };
  delete config.hookToken;
  return {
    config,
    hooks: { ...state.hookInstall, serverError: state.hooks.error, port: state.hooks.port },
  };
}

function broadcastSettings() {
  state.settings?.send('settings:state', settingsState());
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
  if (changes.shuffleDaily === true) await checkShuffle();
  if ('launchAtLogin' in changes) applyLoginItem(result.config.launchAtLogin);
  state.tray?.refresh();
  broadcastSettings();
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
  broadcastSettings();
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
  /** @param {{ quiet?: boolean }} [options]  quiet: no dialog (the settings window shows the message). */
  async installHooks({ quiet = false } = {}) {
    const { hookPort: port, hookToken: token } = state.store.config;
    try {
      const result = await installHooks({ settingsPath: claudeSettingsPath(), port, token });
      await refreshHookStatus();
      const message = `Saved to ${result.settingsPath}.${result.backup ? ` The previous file was backed up to ${result.backup}.` : ''} Start a new Claude Code session (or restart open ones) and the pet will react.`;
      if (!quiet) notify('info', 'Claude Code hooks installed', message);
      return { ok: true, message, ...result };
    } catch (err) {
      await refreshHookStatus();
      if (!quiet) notify('error', "Couldn't install the Claude Code hooks", err.message);
      return { ok: false, message: err.message, error: err.message };
    }
  },
  async uninstallHooks({ quiet = false } = {}) {
    try {
      const result = await uninstallHooks({ settingsPath: claudeSettingsPath() });
      await refreshHookStatus();
      const message = result.changed
        ? `Removed from ${result.settingsPath}. The previous file was backed up to ${result.backup}.`
        : 'There were none to remove.';
      if (!quiet) notify('info', 'Claude Code hooks removed', message);
      return { ok: true, message, ...result };
    } catch (err) {
      await refreshHookStatus();
      if (!quiet) notify('error', "Couldn't remove the Claude Code hooks", err.message);
      return { ok: false, message: err.message, error: err.message };
    }
  },
  openSettings() {
    return state.settings.open();
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

  ipcMain.handle('settings:get-state', (event) => {
    if (!fromSettingsWindow(event)) throw new Error('not allowed');
    return settingsState();
  });
  ipcMain.handle('settings:save', async (event, changes) => {
    if (!fromSettingsWindow(event)) throw new Error('not allowed');
    const keys = changes && typeof changes === 'object' && !Array.isArray(changes) ? Object.keys(changes) : [];
    if (keys.length === 0 || !keys.every((key) => USER_KEYS.has(key))) {
      return { ok: false, errors: [{ key: null, message: 'Unknown setting.' }], state: settingsState() };
    }
    if (testing && state.testSaveDelayMs) await new Promise((resolve) => setTimeout(resolve, state.testSaveDelayMs));
    const result = await setConfig(changes);
    return { ...result, state: settingsState() };
  });
  ipcMain.handle('settings:pick-folder', async (event) => {
    if (!fromSettingsWindow(event)) throw new Error('not allowed');
    if (testing) return state.testFolderPicks.shift() ?? null;
    const { canceled, filePaths } = await dialog.showOpenDialog(state.settings.window, {
      title: 'Watch a folder',
      buttonLabel: 'Watch this folder',
      properties: ['openDirectory'],
    });
    return canceled || filePaths.length === 0 ? null : filePaths[0];
  });
  ipcMain.handle('settings:install-hooks', async (event) => {
    if (!fromSettingsWindow(event)) throw new Error('not allowed');
    const { ok, message } = await actions.installHooks({ quiet: true });
    return { ok, message, state: settingsState() };
  });
  ipcMain.handle('settings:uninstall-hooks', async (event) => {
    if (!fromSettingsWindow(event)) throw new Error('not allowed');
    const { ok, message } = await actions.uninstallHooks({ quiet: true });
    return { ok, message, state: settingsState() };
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
  state.settings = createSettingsWindow({
    url: rendererUrl('settings.html'),
    webPreferences: secureWebPreferences(SETTINGS_PRELOAD),
  });
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
  applyLoginItem(state.store.config.launchAtLogin);
  await checkShuffle();
  state.shuffleTimer = setInterval(() => checkShuffle().catch(() => {}), 60_000);
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
    clearInterval(state.shuffleTimer);
    state.settings?.close();
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
    settingsState,
    checkShuffle: (ms) => checkShuffle(new Date(ms)),
  };
}
