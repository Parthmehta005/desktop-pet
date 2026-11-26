// Electron main process: app lifecycle, the pet window and its IPC.
import { app, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { createPetWindow, PET_WINDOW_OPTIONS } from './pet-window.js';
import { registerAppScheme, handleAppProtocol, hardenApp, secureWebPreferences } from './security.js';
import { rendererUrl } from './app-paths.js';
import { createConfigStore } from './config-store.js';

// Tests (and anyone who wants a separate profile) can point the app at another folder
// for its settings, so they never touch the real ones.
if (process.env.DESKTOP_PET_USER_DATA) app.setPath('userData', process.env.DESKTOP_PET_USER_DATA);
const testing = process.env.DESKTOP_PET_TEST === '1';
// The pet never needs the internet: stop Chromium's background update checks.
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
const PRELOAD = fileURLToPath(new URL('./preload.cjs', import.meta.url));

const state = { petWindow: null, store: null };

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
  return { ok: true, errors: [] };
}

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
}

registerAppScheme();
const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
  // The pet is already running; one pet is plenty.
  app.quit();
} else {
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
  app.whenReady().then(start).catch((err) => {
    console.error('Desktop Pet failed to start:', err);
    app.exit(1);
  });
}

// Tests reach in through this; it is only set when DESKTOP_PET_TEST=1.
if (testing) globalThis.__desktopPet = { state, PET_WINDOW_OPTIONS, sendToPet, setConfig };
