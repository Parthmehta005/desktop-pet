// Watches your repos: file edits make the pet `focused`, new commits make it celebrate.
//
// For each watched folder it watches files (skipping tool output, see repo-rules.js),
// and for each git repo at the folder or one level below it, it follows the reflog
// (.git/logs/HEAD), which git appends a line to on every commit.
import { watch as chokidarWatch } from 'chokidar';
import { readFile, stat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isIgnoredPath, newCommits, resolveGitDir, IGNORED_DIRS } from './repo-rules.js';

/** A burst of edits is reported at most this often per folder. */
export const ACTIVITY_THROTTLE_MS = 5000;
/** How deep inside a watched folder edits are noticed. */
export const MAX_DEPTH = 12;

async function gitDirFor(root) {
  const dotGit = path.join(root, '.git');
  try {
    const info = await stat(dotGit);
    if (info.isDirectory()) return resolveGitDir(root, { isDirectory: true });
    return resolveGitDir(root, { isDirectory: false, content: await readFile(dotGit, 'utf8') });
  } catch {
    return null;
  }
}

/** Repos to follow for a watched folder: the folder itself, or repos directly inside it. */
async function findRepos(folder) {
  const own = await gitDirFor(folder);
  if (own) return [{ root: folder, gitDir: own }];
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return [];
  }
  const repos = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIRS.includes(entry.name)) continue;
    const root = path.join(folder, entry.name);
    const gitDir = await gitDirFor(root);
    if (gitDir) repos.push({ root, gitDir });
  }
  return repos;
}

/**
 * Comparable form of a path. chokidar may report a path with other slashes or letter
 * case than we gave it on Windows, so compare normalised forms, never raw strings.
 */
function pathKey(p) {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.replace(/\//g, '\\').toLowerCase() : resolved;
}

/** The real path (Windows short names like RUNNER~1 expanded), or the path itself. */
async function realPath(p) {
  try {
    return await realpath(p);
  } catch {
    return p;
  }
}

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

/**
 * @param {object} options
 * @param {(folder: string) => void} options.onActivity  Files changed in a watched folder.
 * @param {(folder: string, repoRoot: string) => void} options.onCommit  A commit landed.
 */
export function createRepoWatcher({
  onActivity,
  onCommit,
  watch = chokidarWatch,
  now = Date.now,
  throttleMs = ACTIVITY_THROTTLE_MS,
  onError = (err) => console.warn('Desktop Pet: repo watcher:', err.message),
}) {
  /** folder -> { watchers: FSWatcher[], ready: Promise } */
  const watched = new Map();

  function whenReady(watcher) {
    return new Promise((resolve) => watcher.once('ready', resolve));
  }

  function watchFiles(folder) {
    let lastActivity = -Infinity;
    const watcher = watch(folder, {
      ignored: (p) => isIgnoredPath(p, folder),
      ignoreInitial: true,
      followSymlinks: false,
      depth: MAX_DEPTH,
    });
    watcher.on('all', (event) => {
      if (!['add', 'change', 'unlink'].includes(event)) return;
      const t = now();
      if (t - lastActivity < throttleMs) return;
      lastActivity = t;
      onActivity(folder);
    });
    watcher.on('error', onError);
    return watcher;
  }

  function watchReflog(folder, { root, gitDir }) {
    const logsDir = path.join(gitDir, 'logs');
    const head = path.join(logsDir, 'HEAD');
    const keys = { gitDir: pathKey(gitDir), logsDir: pathKey(logsDir), head: pathKey(head) };
    let offset = 0;
    let reading = Promise.resolve();
    const sizeReady = fileSize(head).then((size) => { offset = size; });

    async function readNew() {
      await sizeReady;
      const size = await fileSize(head);
      if (size < offset) {
        // The reflog was rewritten (e.g. expired): skip, don't re-celebrate old commits.
        offset = size;
        return;
      }
      if (size === offset) return;
      const handle = await open(head, 'r');
      try {
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(size - offset), 0, size - offset, offset);
        const text = buffer.subarray(0, bytesRead).toString('utf8');
        const complete = text.lastIndexOf('\n') + 1; // only whole lines; the rest comes later
        offset += Buffer.byteLength(text.slice(0, complete));
        if (newCommits(text.slice(0, complete)).length) onCommit(folder, root);
      } finally {
        await handle.close();
      }
    }

    // Watch the git dir shallowly, ignoring everything but logs/HEAD: one cheap watch
    // that also works before the first commit creates the file.
    const watcher = watch(gitDir, {
      ignored: (p) => {
        const key = pathKey(p);
        return key !== keys.gitDir && key !== keys.logsDir && key !== keys.head;
      },
      ignoreInitial: true,
      depth: 1,
    });
    watcher.on('all', (event, p) => {
      if (pathKey(p) !== keys.head || (event !== 'add' && event !== 'change')) return;
      reading = reading.then(readNew).catch(onError);
    });
    watcher.on('error', onError);
    return { watcher, ready: Promise.all([whenReady(watcher), sizeReady]) };
  }

  async function add(folder) {
    const files = watchFiles(folder);
    // Listen for 'ready' before awaiting anything: a small folder can finish its first
    // scan while we look for repos, and a missed 'ready' would never come again.
    const filesReady = whenReady(files);
    const repos = await Promise.all((await findRepos(folder)).map(async (repo) => ({
      root: repo.root,
      gitDir: await realPath(repo.gitDir),
    })));
    const reflogs = repos.map((repo) => watchReflog(folder, repo));
    watched.set(folder, {
      watchers: [files, ...reflogs.map((r) => r.watcher)],
      ready: Promise.all([filesReady, ...reflogs.map((r) => r.ready)]),
    });
  }

  async function remove(folder) {
    const entry = watched.get(folder);
    watched.delete(folder);
    await Promise.all(entry.watchers.map((w) => w.close()));
  }

  return {
    /** Watches exactly these folders, starting and stopping watchers as needed. */
    async setFolders(folders) {
      const wanted = new Set(folders);
      for (const folder of [...watched.keys()]) if (!wanted.has(folder)) await remove(folder);
      for (const folder of wanted) if (!watched.has(folder)) await add(folder);
    },
    /** Resolves when every watcher has finished its initial scan. */
    async whenReady() {
      await Promise.all([...watched.values()].map((w) => w.ready));
    },
    get folders() {
      return [...watched.keys()];
    },
    async close() {
      for (const folder of [...watched.keys()]) await remove(folder);
    },
  };
}
