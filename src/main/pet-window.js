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
  let lifted = false;
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
    win.setBounds(stripBounds(workArea, size, { lifted }));
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

  // Click-through: the window ignores the mouse (clicks reach whatever is behind it) but
  // still gets mouse moves, so the renderer can tell us when the pointer is on the pet.
  let interactive = false;
  win.setIgnoreMouseEvents(true, { forward: true });

  // "Hide pet" can come before the page has loaded; don't show it then.
  let hidden = false;
  win.once('ready-to-show', () => { if (!hidden) win.showInactive(); });

  // If the page crashes or is killed, bring the pet back instead of leaving an empty
  // window. More than three crashes in a minute means something is badly wrong: stop.
  let crashes = [];
  win.webContents.on('render-process-gone', (_event, details) => {
    if (win.isDestroyed() || details.reason === 'clean-exit') return;
    interactive = false;
    win.setIgnoreMouseEvents(true, { forward: true });
    // A page that stopped mid-drag can't put the window back: do it here.
    if (lifted) {
      lifted = false;
      relayout();
    }
    const now = Date.now();
    crashes = [...crashes.filter((t) => now - t < 60_000), now];
    if (crashes.length > 3) {
      console.error(`Desktop Pet: the pet's page keeps crashing (${details.reason}); not reloading it again.`);
      return;
    }
    console.warn(`Desktop Pet: the pet's page stopped (${details.reason}); reloading it.`);
    win.webContents.reload();
  });

  return {
    win,
    relayout,
    setPetSize(next) {
      size = next;
      relayout();
    },
    /**
     * true while the pet is carried or falling: the window then fills the work area so
     * the pet can be lifted anywhere. false puts it back to the strip.
     */
    setLifted(next) {
      if (next === lifted) return;
      lifted = next;
      relayout();
    },
    get lifted() {
      return lifted;
    },
    /** true while the pointer is over the pet (or dragging it): catch clicks then. */
    setInteractive(over) {
      if (over === interactive || win.isDestroyed()) return;
      interactive = over;
      if (over) win.setIgnoreMouseEvents(false);
      else win.setIgnoreMouseEvents(true, { forward: true });
    },
    get interactive() {
      return interactive;
    },
    /** Hides or shows the pet. Its page keeps running, so its mood stays current. */
    setHidden(next) {
      if (win.isDestroyed()) return;
      hidden = next;
      if (hidden) win.hide();
      else win.showInactive();
    },
    get hidden() {
      return hidden;
    },
  };
}
