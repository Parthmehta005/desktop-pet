// Decides which CI checks a commit needs, without leaving anything that could break
// untested. It compares the commit with the nearest commit in its history that already
// passed CI, and picks one of:
//   full  everything, on Linux and Windows
//   docs  lint and unit tests on both systems: since that commit only docs changed (root
//         *.md files and docs/), which aren't part of the app and which only the unit
//         tests read (test/unit/ci-plan.test.js keeps it that way)
//   none  nothing: these exact files already passed
// Only runs from a push or by hand count as passed, because they test exactly their
// commit (a pull request run tests a merge with main instead). With no such commit in the
// history, or if anything goes wrong, or when run by hand, it says full.
//
// In CI: node scripts/ci-plan.js   (needs GITHUB_TOKEN, GITHUB_SHA and the full history)
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const TIERS = ['full', 'docs', 'none'];
const DOCS = /^(?:[^/]+\.md|docs\/.+)$/;
const HISTORY_LIMIT = 500;

/** A file path relative to the repository root, with forward slashes. */
export const isDocsFile = (file) => DOCS.test(file);

/**
 * @param {object} p
 * @param {string[]} p.history this commit and its ancestors, newest first
 * @param {Set<string>} p.passed commits that passed CI
 * @param {(baseline: string) => string[]} p.changedSince files that differ from baseline
 */
export function decideTier({ history, passed, changedSince }) {
  const baseline = history.find((sha) => passed.has(sha)) ?? null;
  if (!baseline) {
    return { tier: 'full', baseline, changed: null, reason: 'no commit in its history has passed CI yet' };
  }
  const changed = changedSince(baseline);
  if (changed.length === 0) {
    return { tier: 'none', baseline, changed, reason: `its files are exactly those of ${short(baseline)}, which passed` };
  }
  if (changed.every(isDocsFile)) {
    return { tier: 'docs', baseline, changed, reason: `only docs changed since ${short(baseline)}, which passed` };
  }
  return { tier: 'full', baseline, changed, reason: `code changed since ${short(baseline)}, the last commit that passed` };
}

const short = (sha) => sha.slice(0, 7);

const WHAT_RUNS = {
  full: 'Everything runs, on Linux and Windows.',
  docs: 'Lint and unit tests run on Linux and Windows (the unit tests check the docs); the rest is skipped.',
  none: 'Nothing needs to run.',
};

/** Successful CI runs that tested exactly their commit. */
export async function passedCommits({ env, fetchJson }) {
  const api = env.GITHUB_API_URL || 'https://api.github.com';
  const url = `${api}/repos/${env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?status=success&per_page=100`;
  const { workflow_runs: runs } = await fetchJson(url, { Authorization: `Bearer ${env.GITHUB_TOKEN}` });
  if (!Array.isArray(runs)) throw new Error('the list of CI runs came back without any runs');
  return new Set(runs
    .filter((r) => r.conclusion === 'success' && (r.event === 'push' || r.event === 'workflow_dispatch'))
    .map((r) => r.head_sha));
}

export async function plan({ env, git, fetchJson }) {
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    return { tier: 'full', baseline: null, changed: null, reason: 'it was started by hand' };
  }
  try {
    const head = env.GITHUB_SHA;
    if (!/^[0-9a-f]{40}$/.test(head ?? '')) throw new Error('GITHUB_SHA is not a commit');
    const history = git(['rev-list', `--max-count=${HISTORY_LIMIT}`, head]).split('\n').filter(Boolean);
    const passed = await passedCommits({ env, fetchJson });
    // --no-renames, so a file moved into docs/ also counts as a file removed from its old place.
    const changedSince = (baseline) => git(['diff', '--no-renames', '--name-only', '-z', baseline, head])
      .split('\0').filter(Boolean);
    return decideTier({ history, passed, changedSince });
  } catch (error) {
    return { tier: 'full', baseline: null, changed: null, reason: `the plan couldn't be worked out (${error.message})` };
  }
}

export function report(result) {
  const files = result.changed?.length
    ? `\n\nChanged: ${result.changed.slice(0, 20).map((f) => `\`${f}\``).join(', ')}${result.changed.length > 20 ? ', ...' : ''}`
    : '';
  return `### CI plan: ${result.tier}\n\n${WHAT_RUNS[result.tier]} Why: ${result.reason}.${files}\n`;
}

export async function main({ env, git, fetchJson, append = appendFileSync, log = console.log }) {
  const result = await plan({ env, git, fetchJson });
  if (!TIERS.includes(result.tier)) throw new Error(`unknown tier ${result.tier}`);
  if (!env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is not set');
  append(env.GITHUB_OUTPUT, `tier=${result.tier}\n`);
  if (env.GITHUB_STEP_SUMMARY) append(env.GITHUB_STEP_SUMMARY, report(result));
  log(report(result));
  return result;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...headers },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for the list of CI runs`);
  return res.json();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  main({ env: process.env, git, fetchJson }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
