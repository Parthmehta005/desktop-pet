// Rules for watching repos: what doesn't count as "you editing", and how to read git's
// reflog to spot new commits. Pure functions, unit tested.
import path from 'node:path';

/**
 * Folder names whose contents are tools' output, not your edits. Matched against any
 * path segment below the watched folder.
 */
export const IGNORED_DIRS = Object.freeze([
  '.git', 'node_modules', 'bower_components', 'jspm_packages', 'vendor',
  'dist', 'build', 'out', 'target', 'bin', 'obj', 'coverage', '.nyc_output',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.parcel-cache', '.cache', '.vite', '.angular',
  '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.venv', 'venv', '.tox',
  '.gradle', '.idea', '.vs', '.vscode-test', 'test-results', 'playwright-report',
]);
const IGNORED = new Set(IGNORED_DIRS);

/** True if a changed path (inside `root`) shouldn't count as editing. */
export function isIgnoredPath(changed, root) {
  const relative = path.relative(root, changed);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return relative.split(/[\\/]+/).some((segment) => IGNORED.has(segment));
}

/**
 * Reflog line: "<old sha> <new sha> <name> <email> <unix time> <tz>\t<message>".
 * Returns { oldSha, newSha, message } or null for anything else.
 */
export function parseReflogLine(line) {
  const m = line.match(/^([0-9a-f]{40}|[0-9a-f]{64}) ([0-9a-f]{40}|[0-9a-f]{64}) [^\t]*\t(.*)$/);
  return m ? { oldSha: m[1], newSha: m[2], message: m[3] } : null;
}

/**
 * True for reflog messages that mean "a commit was made": `commit: ...`,
 * `commit (initial): ...`, `commit (amend): ...`, `commit (merge): ...`, and
 * cherry-picks. Checkouts, resets, rebases, pulls and fast-forward merges don't count.
 */
export function isCommitMessage(message) {
  return /^commit( \((initial|amend|merge)\))?: /.test(message) || /^cherry-pick: /.test(message);
}

/** The commits among newly appended reflog text. */
export function newCommits(appendedText) {
  return appendedText.split(/\r?\n/)
    .map(parseReflogLine)
    .filter((entry) => entry && isCommitMessage(entry.message));
}

/**
 * The git directory for a repo root, given what's at <root>/.git: a folder (normal
 * repo) or a file "gitdir: <path>" (worktrees and submodules).
 * @param {string} root
 * @param {{ isDirectory: boolean, content?: string }} dotGit
 */
export function resolveGitDir(root, dotGit) {
  const direct = path.join(root, '.git');
  if (dotGit.isDirectory) return direct;
  const m = (dotGit.content ?? '').match(/^gitdir:\s*(.+?)\s*$/m);
  if (!m) return null;
  return path.resolve(root, m[1]);
}
