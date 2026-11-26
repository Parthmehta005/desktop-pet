// Maps app:// URLs to files. Pure (no Electron) so it can be unit tested.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The src/ folder: app://desktop-pet/<dir>/<file> serves src/<dir>/<file>. */
export const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const APP_HOST = 'desktop-pet';
export const APP_ORIGIN = `app://${APP_HOST}`;

/** Only the code a web page needs: never the main process. */
const SERVED_DIRS = ['renderer', 'core'];
const EXTENSIONS = new Set(['.html', '.js', '.css', '.png', '.svg']);

/** The file for an app:// URL path, or null if it isn't one we serve. */
export function resolveAppPath(urlPath, root = SRC_ROOT) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter(Boolean);
  if (segments.length < 2 || !SERVED_DIRS.includes(segments[0])) return null;
  if (segments.some((s) => s === '..' || s === '.')) return null;
  const file = path.resolve(root, ...segments);
  if (!file.startsWith(path.resolve(root, segments[0]) + path.sep)) return null;
  if (!EXTENSIONS.has(path.extname(file).toLowerCase())) return null;
  return file;
}

/** The app:// URL for a page under src/renderer. */
export function rendererUrl(page) {
  return `${APP_ORIGIN}/renderer/${page}`;
}
