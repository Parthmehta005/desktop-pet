// The tray icon and its menu.
import { Tray, Menu, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { buildTrayMenu } from './tray-menu.js';

// tray@2x.png next to it is picked up automatically on high-DPI screens.
const ICON = fileURLToPath(new URL('../../assets/tray.png', import.meta.url));

/**
 * @param {{ getState: () => object, actions: object }} options  See buildTrayMenu().
 */
export function createTray({ getState, actions }) {
  const tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip('Desktop Pet');
  // On Windows a left click usually opens the menu too.
  tray.on('click', () => tray.popUpContextMenu());

  function refresh() {
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenu(getState(), actions)));
  }
  refresh();

  return {
    tray,
    refresh,
    destroy: () => tray.destroy(),
  };
}
