// The pet's window: a transparent, frameless, always-on-top strip along the bottom of
// the primary display's work area.
import { BrowserWindow, screen } from 'electron';
import { stripBounds } from '../core/layout.js';

/** Window options; exported so tests can check them. */
export const PET_WINDOW_OPTIONS = Object.freeze({
  title: 'Desktop Pet',
  transparent: true,
  backgroundColor: '#00000000',
  frame: false,
  hasShadow: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: false,
  movable: false,
  minimizable: false,
  maximizable: false,
  fullscreenable: false,
  focusable: false,
  show: false,
});

/**
 * @param {object} options
 * @param {number} options.petSize            From config.
 * @param {object} [options.webPreferences]   Added in the security step.
 */
export function createPetWindow({ petSize = 1, webPreferences = {} } = {}) {
  let size = petSize;
  const win = new BrowserWindow({
    ...PET_WINDOW_OPTIONS,
    ...stripBounds(screen.getPrimaryDisplay().workArea, size),
    webPreferences,
  });
  // Above ordinary always-on-top windows, but below things like the screen saver.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);

  function relayout(workArea = screen.getPrimaryDisplay().workArea) {
    if (win.isDestroyed()) return;
    win.setBounds(stripBounds(workArea, size));
  }

  const onDisplayChange = () => relayout();
  screen.on('display-metrics-changed', onDisplayChange);
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  win.on('closed', () => {
    screen.off('display-metrics-changed', onDisplayChange);
    screen.off('display-added', onDisplayChange);
    screen.off('display-removed', onDisplayChange);
  });

  win.once('ready-to-show', () => win.showInactive());

  return {
    win,
    relayout,
    setPetSize(next) {
      size = next;
      relayout();
    },
  };
}
