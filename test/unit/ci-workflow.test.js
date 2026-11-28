// The CI workflow: every check runs on the systems it should, so splitting or skipping
// jobs never quietly drops one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const WORKFLOW = await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');

/** The jobs in a workflow: { id: { text, runsOn: [os], if, needs, commands } }. */
function parseJobs(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.indexOf('jobs:');
  assert.ok(start >= 0, 'the workflow has jobs');
  const jobs = {};
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const id = line.match(/^ {2}([\w-]+):$/);
    if (id) {
      current = jobs[id[1]] = { lines: [] };
      continue;
    }
    if (/^\S/.test(line)) break;
    current?.lines.push(line);
  }
  for (const job of Object.values(jobs)) {
    const body = job.lines.join('\n');
    const field = (name) => body.match(new RegExp(`^ {4}${name}: (.+)$`, 'm'))?.[1].trim() ?? null;
    const runsOn = field('runs-on');
    job.runsOn = runsOn === '${{ matrix.os }}'
      ? body.match(/^ {8}os: \[(.+)\]$/m)[1].split(',').map((s) => s.trim())
      : [runsOn];
    job.if = field('if');
    job.needs = field('needs');
    job.commands = [...body.matchAll(/^ +(?:- )?run: (?!\|)(.+)$/gm)].map((m) => m[1].trim());
    job.text = body;
    delete job.lines;
  }
  return jobs;
}

const JOBS = parseJobs(WORKFLOW);
const onOs = (os) => Object.values(JOBS).filter((j) => j.runsOn.includes(os)).flatMap((j) => j.commands);

test('every check runs on Linux', () => {
  const linux = onOs('ubuntu-latest');
  for (const check of ['npm run lint', 'npm test', 'npm run test:browser', 'npm run test:electron',
    'npm run dist:dir && npm run test:packaged']) {
    assert.ok(linux.includes(check), `Linux runs ${check}`);
  }
});

test('every check runs on Windows, with the installer built and its files uploaded', () => {
  const windows = onOs('windows-latest');
  for (const check of ['npm run lint', 'npm test', 'node --test test/windows/foreground.test.js',
    'npm run test:electron', 'npm run dist:win', 'npm run test:packaged']) {
    assert.ok(windows.includes(check), `Windows runs ${check}`);
  }
  const installer = Object.values(JOBS).find((j) => j.commands.includes('npm run dist:win'));
  assert.ok(installer.commands.indexOf('npm run dist:win') < installer.commands.indexOf('npm run test:packaged'),
    'the built app is tested after it is built, in the same job');
  assert.match(installer.text, /name: desktop-pet-windows\n\s+path: dist\/\*\.exe\n\s+if-no-files-found: error/);
});

test('the Windows app tests and the installer build are separate jobs, so they run at the same time', () => {
  const windowsJobs = Object.entries(JOBS).filter(([, j]) => j.runsOn.includes('windows-latest') && !j.runsOn.includes('ubuntu-latest'));
  const appJob = windowsJobs.find(([, j]) => j.commands.includes('npm run test:electron'));
  const buildJob = windowsJobs.find(([, j]) => j.commands.includes('npm run dist:win'));
  assert.ok(appJob && buildJob && appJob[0] !== buildJob[0]);
  assert.ok(!(buildJob[1].needs ?? '').includes(appJob[0]) && !(appJob[1].needs ?? '').includes(buildJob[0]),
    'neither waits for the other');
});

test('the job parser reads this workflow', () => {
  assert.ok(Object.keys(JOBS).length >= 5);
  for (const job of Object.values(JOBS)) {
    assert.ok(job.runsOn.every((os) => ['ubuntu-latest', 'windows-latest'].includes(os)), job.runsOn.join());
    assert.ok(job.commands.length > 0);
  }
});

// What GitHub does with a job's condition, for the only form these conditions take:
// comparisons of the plan's tier joined by &&.
function runsWhen(condition, tier) {
  if (condition === null) return true;
  return condition.split('&&').every((part) => {
    const m = part.trim().match(/^needs\.plan\.outputs\.tier (!=|==) '([a-z]*)'$/);
    assert.ok(m, `a condition this test understands: ${part}`);
    return m[1] === '!=' ? tier !== m[2] : tier === m[2];
  });
}

test('a plan job decides first, and every other job waits for it', () => {
  const { plan, ...rest } = JOBS;
  assert.ok(plan, 'there is a plan job');
  assert.deepEqual(plan.runsOn, ['ubuntu-latest']);
  assert.equal(plan.needs, null);
  assert.ok(plan.commands.includes('node scripts/ci-plan.js'));
  assert.match(plan.text, /fetch-depth: 0/, 'it needs the whole history to find a commit that passed');
  assert.match(plan.text, /tier: \$\{\{ steps\.plan\.outputs\.tier \}\}/);
  assert.match(plan.text, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  for (const [id, job] of Object.entries(rest)) assert.equal(job.needs, 'plan', `${id} waits for the plan`);
  assert.match(WORKFLOW, /^permissions:\n {2}contents: read\n(?: {2}#.*\n)? {2}actions: read\n\n/m, 'read-only, plus reading earlier runs');
});

test('full runs everything, docs runs lint and unit tests on both systems, none runs nothing', () => {
  const ran = (tier) => onTier(tier).flatMap(([, j]) => j.runsOn.map((os) => `${os}: ${j.commands.join(' ; ')}`)).sort();
  const onTier = (tier) => Object.entries(JOBS).filter(([id, j]) => id !== 'plan' && runsWhen(j.if, tier));
  const all = Object.keys(JOBS).filter((id) => id !== 'plan').sort();
  assert.deepEqual(onTier('full').map(([id]) => id).sort(), all);
  assert.deepEqual(onTier('none'), []);
  const docs = onTier('docs');
  assert.deepEqual(docs.map(([id]) => id), ['test']);
  assert.deepEqual(docs[0][1].runsOn, ['ubuntu-latest', 'windows-latest']);
  assert.deepEqual(docs[0][1].commands, ['npm ci', 'npm run lint', 'npm test']);
  assert.ok(ran('full').length > ran('docs').length);
});

test('a missing or unexpected plan runs everything', () => {
  for (const tier of ['', 'Full', 'skip', 'nothing']) {
    for (const [id, job] of Object.entries(JOBS)) {
      if (id !== 'plan') assert.equal(runsWhen(job.if, tier), true, `${id} runs when the plan says "${tier}"`);
    }
  }
});

test('the plan only ever says one of the tiers the conditions know', async () => {
  const { TIERS } = await import('../../scripts/ci-plan.js');
  assert.deepEqual(TIERS, ['full', 'docs', 'none']);
  const named = new Set([...WORKFLOW.matchAll(/needs\.plan\.outputs\.tier [!=]= '([a-z]*)'/g)].map((m) => m[1]));
  assert.deepEqual([...named].sort(), ['docs', 'none'], 'conditions only name the tiers that skip something');
});
