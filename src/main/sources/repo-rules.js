// Rules for watching repos: what doesn't count as "you editing". Pure, unit tested.
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
