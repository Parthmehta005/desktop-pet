// Electron main process: app lifecycle and the pet window.
import { app } from 'electron';
import { createPetWindow, PET_WINDOW_OPTIONS } from './pet-window.js';

// Tests (and anyone who wants a separate profile) can point the app at another folder
// for its settings, so they never touch the real ones.
if (process.env.DESKTOP_PET_USER_DATA) app.setPath('userData', process.env.DESKTOP_PET_USER_DATA);
const testing = process.env.DESKTOP_PET_TEST === '1';

const state = { petWindow: null };

async function start() {
  state.petWindow = createPetWindow({ petSize: 1 });
  await state.petWindow.win.loadURL('about:blank');
}

const isFirstInstance = app.requestSingleInstanceLock();

if (!isFirstInstance) {
  // The pet is already running; one pet is plenty.
  app.quit();
} else {
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
if (testing) globalThis.__desktopPet = { state, PET_WINDOW_OPTIONS };
