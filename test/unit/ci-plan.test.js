// The CI planner: which checks a commit needs. It may only skip checks when the files
// they test are exactly ones that already passed, so every case that could hide a
// problem must come out as "full".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideTier, isDocsFile, main, passedCommits, plan, report } from '../../scripts/ci-plan.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

test('docs are the root .md files and docs/, and nothing else', () => {
  for (const f of ['README.md', 'GUIDE.md', 'CHANGELOG.md', 'docs/images/stage.webp', 'docs/a/b.md']) {
    assert.equal(isDocsFile(f), true, f);
  }
  for (const f of ['src/README.md', 'test/unit/x.md', 'package.json', '.github/workflows/ci.yml',
    'src/renderer/pet.css', 'README.md.js', 'docs', 'mydocs/a.md/x.js', 'scripts/release.js']) {
    assert.equal(isDocsFile(f), false, f);
  }
});

test('the tier: nothing when the files already passed, docs for docs only, otherwise full', () => {
  const changed = { b1: [], b2: ['README.md', 'docs/x.webp'], b3: ['README.md', 'src/core/engine.js'] };
  const tier = (history, passed) => decideTier({ history, passed: new Set(passed), changedSince: (b) => changed[b] }).tier;
  assert.equal(tier(['head', 'b1'], ['b1']), 'none');
  assert.equal(tier(['head', 'b2'], ['b2']), 'docs');
  assert.equal(tier(['head', 'b3'], ['b3']), 'full');
  assert.equal(tier(['head', 'x', 'y'], ['z']), 'full', 'nothing in the history passed');
  assert.equal(tier([], []), 'full');
  // The nearest commit that passed is the one compared against.
  assert.equal(tier(['head', 'b3', 'b2'], ['b2', 'b3']), 'full');
  assert.equal(tier(['head', 'b2', 'b3'], ['b2', 'b3']), 'docs');
});

test('only runs that tested exactly their commit count as passed', async () => {
  const runs = [
    { head_sha: 'a', event: 'push', conclusion: 'success' },
    { head_sha: 'b', event: 'workflow_dispatch', conclusion: 'success' },
    { head_sha: 'c', event: 'pull_request', conclusion: 'success' },
    { head_sha: 'd', event: 'push', conclusion: 'failure' },
    { head_sha: 'e', event: 'push', conclusion: 'cancelled' },
  ];
  let asked;
  const env = { GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't' };
  const passed = await passedCommits({ env, fetchJson: async (url, headers) => { asked = { url, headers }; return { workflow_runs: runs }; } });
  assert.deepEqual([...passed].sort(), ['a', 'b']);
  assert.equal(asked.url, 'https://api.github.com/repos/o/r/actions/workflows/ci.yml/runs?status=success&per_page=100');
  assert.equal(asked.headers.Authorization, 'Bearer t');
});

// A real repository, so the git commands are tested too.
async function tempRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ci-plan-'));
  let clock = 1_700_000_000;
  const git = (args) => {
    clock += 60;
    const date = `${clock} +0000`;
    return execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com',
      '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  };
  git(['init', '-q', '-b', 'main']);
  const commit = async (files, message) => {
    for (const [file, content] of Object.entries(files)) {
      const at = path.join(dir, ...file.split('/'));
      if (content === null) await rm(at);
      else {
        await mkdir(path.dirname(at), { recursive: true });
        await writeFile(at, content);
      }
    }
    git(['add', '-A']);
    git(['commit', '-q', '--allow-empty', '-m', message]);
    return git(['rev-parse', 'HEAD']).trim();
  };
  return { dir, git, commit, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const runsOf = (passed) => async () => ({ workflow_runs: passed.map((head_sha) => ({ head_sha, event: 'push', conclusion: 'success' })) });
const envFor = (sha, extra = {}) => ({ GITHUB_SHA: sha, GITHUB_REPOSITORY: 'o/r', GITHUB_TOKEN: 't', GITHUB_EVENT_NAME: 'push', ...extra });

test('in a real history: code, docs, an unchanged commit, a rename and a merge', async () => {
  const r = await tempRepo();
  try {
    const at = (sha, passed, extra) => plan({ env: envFor(sha, extra), git: r.git, fetchJson: runsOf(passed) });
    const a = await r.commit({ 'src/a.js': '1', 'README.md': '# a' }, 'a');
    const b = await r.commit({ 'README.md': '# b', 'docs/images/x.webp': 'img' }, 'docs');
    const c = await r.commit({ 'src/a.js': '2' }, 'code');
    const d = await r.commit({ 'GUIDE.md': 'g' }, 'more docs');

    assert.equal((await at(b, [a])).tier, 'docs');
    assert.deepEqual((await at(b, [a])).changed.sort(), ['README.md', 'docs/images/x.webp']);
    assert.equal((await at(c, [a])).tier, 'full', 'code changed since the commit that passed');
    assert.equal((await at(c, [b])).tier, 'full');
    assert.equal((await at(d, [c])).tier, 'docs');
    assert.equal((await at(d, [a])).tier, 'full', 'a code change in between counts, even if the commit itself is docs');
    assert.equal((await at(c, [c])).tier, 'none', 'the same commit already passed');
    assert.equal((await at(d, [])).tier, 'full');
    // Not in the history: a commit that passed on another branch doesn't count.
    r.git(['checkout', '-q', '-b', 'side', a]);
    const s = await r.commit({ 'README.md': '# side' }, 'side');
    assert.equal((await at(s, [c, d])).tier, 'full');

    // A file moved into docs/ is code removed from its old place.
    r.git(['checkout', '-q', 'main']);
    r.git(['mv', 'src/a.js', 'docs/a.md']);
    const e = await r.commit({}, 'move');
    const moved = await at(e, [d]);
    assert.equal(moved.tier, 'full');
    assert.deepEqual(moved.changed.sort(), ['docs/a.md', 'src/a.js']);

    // A merge, as a pull request run sees it: docs from a branch onto main, which passed.
    r.git(['checkout', '-q', '-b', 'pr', e]);
    await r.commit({ 'CHANGELOG.md': 'c' }, 'pr docs');
    r.git(['checkout', '-q', 'main']);
    const f = await r.commit({ 'src/b.js': 'x' }, 'main moves on');
    r.git(['merge', '-q', '--no-ff', '-m', 'merge', 'pr']);
    const m = r.git(['rev-parse', 'HEAD']).trim();
    assert.equal((await at(m, [f])).tier, 'docs');
    assert.equal((await at(m, [e])).tier, 'full', 'main moved on with code since the commit that passed');
  } finally {
    await r.cleanup();
  }
});

test('anything unusual means everything runs', async () => {
  const r = await tempRepo();
  try {
    const a = await r.commit({ 'src/a.js': '1' }, 'a');
    const b = await r.commit({ 'README.md': 'x' }, 'b');
    const reason = async (env, fetchJson = runsOf([a])) => {
      const result = await plan({ env, git: r.git, fetchJson });
      assert.equal(result.tier, 'full', JSON.stringify(result));
      return result.reason;
    };
    assert.match(await reason(envFor(b, { GITHUB_EVENT_NAME: 'workflow_dispatch' })), /by hand/);
    assert.match(await reason(envFor(b), async () => { throw new Error('GitHub answered 500'); }), /500/);
    assert.match(await reason(envFor(b), async () => ({ message: 'Not Found' })), /without any runs/);
    assert.match(await reason(envFor('not-a-sha')), /not a commit/);
    assert.match(await reason(envFor('f'.repeat(40))), /couldn't be worked out/);
  } finally {
    await r.cleanup();
  }
});

test('main writes the tier for the next jobs, and a summary of why', async () => {
  const r = await tempRepo();
  const out = path.join(r.dir, '..', `${path.basename(r.dir)}-out`);
  try {
    const a = await r.commit({ 'src/a.js': '1' }, 'a');
    const b = await r.commit({ 'README.md': 'x' }, 'b');
    const written = {};
    const append = (file, text) => { written[file] = (written[file] ?? '') + text; };
    const env = envFor(b, { GITHUB_OUTPUT: `${out}/output`, GITHUB_STEP_SUMMARY: `${out}/summary` });
    const result = await main({ env, git: r.git, fetchJson: runsOf([a]), append, log: () => {} });
    assert.equal(result.tier, 'docs');
    assert.equal(written[`${out}/output`], 'tier=docs\n');
    assert.match(written[`${out}/summary`], /CI plan: docs/);
    assert.match(written[`${out}/summary`], /`README\.md`/);
    await assert.rejects(main({ env: envFor(b), git: r.git, fetchJson: runsOf([a]), append, log: () => {} }), /GITHUB_OUTPUT/);
  } finally {
    await r.cleanup();
  }
});

test('the summary says what runs and why', () => {
  assert.match(report({ tier: 'full', reason: 'it was started by hand', changed: null }), /Everything runs.*by hand/s);
  const many = Array.from({ length: 25 }, (_, i) => `docs/${i}.webp`);
  const text = report({ tier: 'docs', reason: 'only docs changed', changed: many });
  assert.match(text, /Lint and unit tests/);
  assert.match(text, /`docs\/19\.webp`, \.\.\.$/m);
});

// The docs tier skips the browser, Electron, built-app and Windows tests. That's only
// safe while docs aren't in the app and none of those tests (or what they run) read them.
test('docs are not shipped in the app, and only the unit tests read them', async () => {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  for (const entry of pkg.build.files) {
    assert.ok(!/\.md\b|(^|\/)docs(\/|$)/.test(entry), `build.files ships docs: ${entry}`);
  }
  const docNames = (await readdir(ROOT)).filter(isDocsFile);
  assert.ok(docNames.includes('README.md') && docNames.includes('GUIDE.md'));
  const DIRS = ['src', 'preview', 'test/browser', 'test/electron', 'test/packaged', 'test/windows', 'scripts'];
  // release.js reads CHANGELOG.md; only the unit tests and the release workflow run it.
  const NOT_RUN_BY_SKIPPED_SUITES = new Set(['scripts/release.js', 'scripts/ci-plan.js']);
  // Writes a README.md of its own into a temporary repository; it never reads this one's.
  const OWN_COPY = new Set(['test/electron/sources.spec.js']);
  const files = [];
  for (const dir of DIRS) {
    for (const f of await readdir(path.join(ROOT, dir), { recursive: true })) {
      if (/\.(c?js|mjs|html|css|ps1|json)$/.test(f)) files.push(`${dir}/${f.split(path.sep).join('/')}`);
    }
  }
  for (const f of await readdir(ROOT)) if (/\.config\.c?js$/.test(f)) files.push(f);
  assert.ok(files.length > 50, 'found the files to check');
  const quoted = (name) => new RegExp(`['"\`/]${name.replace('.', '\\.')}['"\`]`);
  const offenders = [];
  for (const f of files) {
    if (NOT_RUN_BY_SKIPPED_SUITES.has(f) || OWN_COPY.has(f)) continue;
    const text = await readFile(path.join(ROOT, f), 'utf8');
    for (const name of docNames) if (quoted(name).test(text)) offenders.push(`${f} names ${name}`);
    if (/['"`]\.{0,2}\/?docs\//.test(text)) offenders.push(`${f} names docs/`);
  }
  assert.deepEqual(offenders, [], 'these read docs, so a docs-only change would need the full CI');
});
