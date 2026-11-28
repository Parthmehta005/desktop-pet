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
