// Electron main process: app lifecycle. Filled in over M5.
import { app } from 'electron';

// Tests (and anyone who wants a separate profile) can point the app at another folder
// for its settings, so they never touch the real ones.
if (process.env.DESKTOP_PET_USER_DATA) app.setPath('userData', process.env.DESKTOP_PET_USER_DATA);

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
}
