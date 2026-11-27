// Replacing a file by renaming a temporary copy over it (how settings are saved
// atomically). On Windows that rename fails for a moment with EPERM, EACCES or EBUSY
// while anything else has the file open: antivirus scanning it, an indexer, a backup
// tool, or a program reading it. So on Windows, try again for a little while before
// giving up. Elsewhere those errors are real permission problems, so fail at once.
import { rename as fsRename } from 'node:fs/promises';
import { renameSync as fsRenameSync } from 'node:fs';

const TRANSIENT = new Set(['EPERM', 'EACCES', 'EBUSY']);
/** Waits between attempts: about 2 seconds in all. */
export const RETRY_DELAYS_MS = Object.freeze([10, 20, 40, 80, 150, 300, 500, 900]);

const retryable = (err, platform) => platform === 'win32' && TRANSIENT.has(err?.code);

export async function renameWithRetry(from, to, {
  platform = process.platform,
  rename = fsRename,
  delays = RETRY_DELAYS_MS,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (err) {
      if (!retryable(err, platform) || attempt >= delays.length) throw err;
      await wait(delays[attempt]);
    }
  }
}

/** The same, blocking; only for start-up, before the app is running. */
export function renameSyncWithRetry(from, to, {
  platform = process.platform,
  renameSync = fsRenameSync,
  delays = RETRY_DELAYS_MS,
  waitSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
} = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return renameSync(from, to);
    } catch (err) {
      if (!retryable(err, platform) || attempt >= delays.length) throw err;
      waitSync(delays[attempt]);
    }
  }
}
