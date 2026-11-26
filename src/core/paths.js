/**
 * Path matching for "is this Claude session / file inside a watched folder?".
 *
 * This module runs in the browser as well as in Node, so it cannot use `node:path`.
 * It understands the path styles the pet sees on a Windows machine:
 *
 *   C:\Users\me\app   c:/users/me/app       Windows drive paths (case-insensitive)
 *   \\server\share\x                        Windows UNC paths (case-insensitive)
 *   \\?\C:\very\long\path                   Windows long-path prefix
 *   /mnt/c/Users/me/app                     WSL view of a Windows drive -> C:\Users\me\app
 *   \\wsl$\Ubuntu\home\me\app               Windows view of a WSL path  -> /home/me/app
 *   \\wsl.localhost\Ubuntu\home\me\app      (same, newer spelling)
 *   /home/me/app                            POSIX paths (case-sensitive)
 *
 * Relative paths are rejected: hook payloads and configured folders are always absolute.
 */

const LONG_PATH_PREFIX = /^\/\/\?\/(?=[a-z]:)/i;
const WSL_UNC = /^\/\/(?:wsl\$|wsl\.localhost)\/[^/]+(\/.*)?$/i;
const WSL_MOUNT = /^\/mnt\/([a-z])(?=\/|$)/i;
const DRIVE = /^([a-z]):(?=\/|$)/i;

/** Splits a path body into segments, resolving "." and ".." without going above the root. */
function resolveSegments(body) {
  const out = [];
  for (const seg of body.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out;
}

/**
 * Canonical form of an absolute path, or null if the input isn't an absolute path.
 *
 * @param {unknown} input
 * @returns {{ kind: 'win' | 'posix', key: string } | null}
 *   `key` is comparable with `===`: Windows keys are lower-cased and use `/`.
 */
export function canonicalPath(input) {
  if (typeof input !== 'string') return null;
  let p = input.trim().replace(/\\/g, '/');
  if (p === '') return null;
  p = p.replace(LONG_PATH_PREFIX, '');

  const wslUnc = p.match(WSL_UNC);
  if (wslUnc) {
    const segs = resolveSegments(wslUnc[1] ?? '');
    return { kind: 'posix', key: '/' + segs.join('/') };
  }

  const mount = p.match(WSL_MOUNT);
  if (mount) p = `${mount[1]}:${p.slice(mount[0].length)}`;

  const drive = p.match(DRIVE);
  if (drive) {
    const segs = resolveSegments(p.slice(2));
    return { kind: 'win', key: `${drive[1]}:/${segs.join('/')}`.toLowerCase() };
  }

  if (p.startsWith('//')) {
    const segs = resolveSegments(p.slice(2));
    if (segs.length < 2) return null; // needs at least //server/share
    return { kind: 'win', key: `//${segs.join('/')}`.toLowerCase() };
  }

  if (p.startsWith('/')) {
    return { kind: 'posix', key: '/' + resolveSegments(p).join('/') };
  }

  return null;
}

export function isAbsolutePath(input) {
  return canonicalPath(input) !== null;
}

/** True if both inputs name the same folder. */
export function samePath(a, b) {
  const ca = canonicalPath(a);
  const cb = canonicalPath(b);
  return ca !== null && cb !== null && ca.kind === cb.kind && ca.key === cb.key;
}

/** True if `child` is `parent` or anywhere underneath it. */
export function isInside(child, parent) {
  const c = canonicalPath(child);
  const p = canonicalPath(parent);
  if (c === null || p === null || c.kind !== p.kind) return false;
  if (c.key === p.key) return true;
  const prefix = p.key.endsWith('/') ? p.key : `${p.key}/`;
  return c.key.startsWith(prefix);
}

/**
 * The watched folder that contains `child` (the deepest one if they nest), exactly as it
 * was written in `folders`, or null if none does.
 */
export function findContainingFolder(child, folders) {
  let best = null;
  let bestLength = -1;
  for (const folder of folders ?? []) {
    if (!isInside(child, folder)) continue;
    const length = canonicalPath(folder).key.length;
    if (length > bestLength) {
      best = folder;
      bestLength = length;
    }
  }
  return best;
}
