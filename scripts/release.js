// Release helpers, used by the release workflow (.github/workflows/release.yml).
//
//   node scripts/release.js check v1.2.3   fails unless the tag is "v" + package.json's
//                                          version and CHANGELOG.md has an entry for it
//   node scripts/release.js notes 1.2.3    prints that version's CHANGELOG entry
//
// Versions follow Semantic Versioning (https://semver.org): MAJOR.MINOR.PATCH.
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** MAJOR.MINOR.PATCH, with an optional pre-release part like 1.1.0-beta.1. */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

/** The CHANGELOG entry for `version` (without its heading), or null if there isn't one. */
export function releaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`## [${version}]`));
  if (start === -1) return null;
  let end = lines.findIndex((l, i) => i > start && (l.startsWith('## ') || /^\[[^\]]+\]: /.test(l)));
  if (end === -1) end = lines.length;
  const notes = lines.slice(start + 1, end).join('\n').trim();
  return notes === '' ? null : notes;
}

/**
 * Whether `tag` can be released: it must be "v" + the package version, a valid semantic
 * version, with an entry in the changelog.
 * @returns {string[]} problems; empty if it's fine
 */
export function checkTag(tag, { version, changelog }) {
  const problems = [];
  if (!SEMVER.test(version)) problems.push(`package.json's version "${version}" isn't a semantic version like 1.2.3`);
  if (tag !== `v${version}`) problems.push(`the tag "${tag}" should be "v${version}" to match package.json`);
  if (releaseNotes(changelog, version) === null) problems.push(`CHANGELOG.md has no entry for ${version} (add a "## [${version}] - date" section)`);
  return problems;
}

export async function run(argv, { stdout = process.stdout, stderr = process.stderr, root = ROOT } = {}) {
  const [command, arg] = argv;
  const pkg = JSON.parse(await readFile(new URL('package.json', pathToFileURL(root)), 'utf8'));
  const changelog = await readFile(new URL('CHANGELOG.md', pathToFileURL(root)), 'utf8');
  if (command === 'check' && arg) {
    const problems = checkTag(arg, { version: pkg.version, changelog });
    if (problems.length) {
      stderr.write(`Can't release ${arg}:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
      return 1;
    }
    stdout.write(`${arg} is ready to release.\n`);
    return 0;
  }
  if (command === 'notes' && arg) {
    const notes = releaseNotes(changelog, arg);
    if (notes === null) {
      stderr.write(`CHANGELOG.md has no entry for ${arg}.\n`);
      return 1;
    }
    stdout.write(`${notes}\n`);
    return 0;
  }
  stderr.write('Usage: node scripts/release.js check <tag> | notes <version>\n');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
