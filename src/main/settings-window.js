// The settings window: an ordinary framed window, opened from the tray. Only one at a
// time; opening it again brings the existing one to the front.
import { BrowserWindow } from 'electron';

export function createSettingsWindow({ url, webPreferences }) {
  let win = null;

  return {
    open() {
      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        return win;
      }
      win = new BrowserWindow({
        title: 'Desktop Pet settings',
        width: 880,
        height: 780,
        minWidth: 560,
        minHeight: 480,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#f6f3ee',
        webPreferences,
      });
      win.removeMenu();
      win.once('ready-to-show', () => win.show());
      win.on('closed', () => { win = null; });
      win.loadURL(url);
      return win;
    },
    /** The window, or null if it isn't open. */
    get window() {
      return win && !win.isDestroyed() ? win : null;
    },
    send(channel, payload) {
      if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
    },
    close() {
      if (win && !win.isDestroyed()) win.close();
    },
  };
}
