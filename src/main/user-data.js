// Where the app keeps its settings. The main process and the command-line hooks tool
// must agree, so both use this. Pinned to "<appData>/desktop-pet" so it never moves
// when the packaged app gets a display name.
import os from 'node:os';
import path from 'node:path';

export const USER_DATA_FOLDER = 'desktop-pet';

/** The same folder Electron calls appData. */
export function appDataDir(env = process.env, platform = process.platform, home = os.homedir()) {
  if (platform === 'win32') return env.APPDATA || path.win32.join(home, 'AppData', 'Roaming');
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support');
  return env.XDG_CONFIG_HOME || path.posix.join(home, '.config');
}

/** The app's settings folder (DESKTOP_PET_USER_DATA overrides it, as in the app). */
export function userDataDir(env = process.env, platform = process.platform, home = os.homedir()) {
  if (env.DESKTOP_PET_USER_DATA) return env.DESKTOP_PET_USER_DATA;
  const join = platform === 'win32' ? path.win32.join : path.posix.join;
  return join(appDataDir(env, platform, home), USER_DATA_FOLDER);
}
