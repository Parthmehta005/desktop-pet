// Versions and releases: the version is a semantic version with a changelog entry, a
// release tag is checked against both, and the release notes come from the changelog.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkTag, releaseNotes, run, SEMVER } from '../../scripts/release.js';

const read = (file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
const pkg = JSON.parse(await read('package.json'));
const CHANGELOG = `# Changelog

## [Unreleased]

## [1.1.0] - 2027-01-02
### Added
- A thing.

## [1.0.0] - 2026-11-27
The first release.

[Unreleased]: https://example.com/compare/v1.1.0...HEAD
[1.1.0]: https://example.com/releases/tag/v1.1.0
`;

test('the version is a semantic version, 1.0.0 or later, with a changelog entry', async () => {
  assert.match(pkg.version, SEMVER);
  assert.ok(Number(pkg.version.split('.')[0]) >= 1, 'released versions start at 1.0.0');
  assert.ok(releaseNotes(await read('CHANGELOG.md'), pkg.version), `CHANGELOG.md has an entry for ${pkg.version}`);
  assert.match(await read('CHANGELOG.md'), /^## \[Unreleased\]$/m, 'there is a place to note the next changes');
});

test('release notes are the version\'s changelog entry and nothing else', () => {
  assert.equal(releaseNotes(CHANGELOG, '1.1.0'), '### Added\n- A thing.');
  assert.equal(releaseNotes(CHANGELOG, '1.0.0'), 'The first release.', 'the last entry stops at the links');
  assert.equal(releaseNotes(CHANGELOG, '2.0.0'), null);
  assert.equal(releaseNotes(CHANGELOG, 'Unreleased'), null, 'an empty entry is no entry');
  assert.equal(releaseNotes('## [1.0.0]\r\nWindows line ends\r\n', '1.0.0'), 'Windows line ends');
});

test('a release tag must match the version and have a changelog entry', () => {
  assert.deepEqual(checkTag('v1.1.0', { version: '1.1.0', changelog: CHANGELOG }), []);
  assert.match(checkTag('v1.2.0', { version: '1.1.0', changelog: CHANGELOG }).join(), /should be "v1.1.0"/);
  assert.match(checkTag('1.1.0', { version: '1.1.0', changelog: CHANGELOG }).join(), /should be "v1.1.0"/);
  assert.match(checkTag('v1.2.0', { version: '1.2.0', changelog: CHANGELOG }).join(), /no entry for 1.2.0/);
  assert.match(checkTag('v1.2', { version: '1.2', changelog: CHANGELOG }).join(), /isn't a semantic version/);
  assert.equal(SEMVER.test('1.1.0-beta.1'), true);
  assert.equal(SEMVER.test('01.0.0'), false);
});

test('the command line: check and notes against the real files', async () => {
  const io = () => {
    const out = { text: '', write(s) { out.text += s; } };
    const err = { text: '', write(s) { err.text += s; } };
    return { stdout: out, stderr: err };
  };
  let o = io();
  assert.equal(await run(['check', `v${pkg.version}`], o), 0);
  assert.match(o.stdout.text, /ready to release/);
  o = io();
  assert.equal(await run(['check', 'v9.9.9'], o), 1);
  assert.match(o.stderr.text, /Can't release v9.9.9/);
  o = io();
  assert.equal(await run(['notes', pkg.version], o), 0);
  assert.match(o.stdout.text, /The first release/);
  o = io();
  assert.equal(await run(['nonsense'], o), 2);
});

test('the release workflow checks and tests everything before it publishes', async () => {
  const wf = await read('.github/workflows/release.yml');
  assert.match(wf, /tags: \['v\*\.\*\.\*'\]/, 'runs on version tags');
  assert.match(wf, /contents: write/, 'may create the release');
  const order = [
    'node scripts/release.js check "$TAG"',
    'npm run lint && npm test',
    'node --test test/windows/foreground.test.js',
    'npm run test:electron',
    'npm run dist:win',
    'npm run test:packaged',
    'gh release create',
  ].map((step) => {
    const at = wf.indexOf(step);
    assert.ok(at > 0, `the workflow runs ${step}`);
    return at;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in that order: nothing is published untested');
  // The stable file names the download links rely on, copied from electron-builder's.
  const build = pkg.build;
  assert.equal(build.nsis.artifactName, 'DesktopPet-Setup-${version}.${ext}');
  assert.equal(build.portable.artifactName, 'DesktopPet-${version}-portable.${ext}');
  assert.match(wf, /cp "dist\/DesktopPet-Setup-\$\{version\}\.exe" release\/DesktopPet-Setup\.exe/);
  assert.match(wf, /cp "dist\/DesktopPet-\$\{version\}-portable\.exe" release\/DesktopPet-Portable\.exe/);
});
