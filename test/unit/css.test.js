// Animations may only move `transform` and `opacity`, which the browser can composite
// without re-laying out the page. This keeps the always-on-top pet window cheap to run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CSS_DIRS = ['src/renderer', 'preview'];
const ALLOWED = new Set(['transform', 'opacity', 'animation-timing-function']);

async function cssFiles() {
  const files = [];
  for (const dir of CSS_DIRS) {
    for (const f of await readdir(path.join(ROOT, dir), { recursive: true })) {
      if (f.endsWith('.css')) files.push(path.join(ROOT, dir, f));
    }
  }
  return files;
}

/** Returns [{ name, body }] for every @keyframes block. */
export function keyframeBlocks(css) {
  const blocks = [];
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
    }
    blocks.push({ name: m[1], body: css.slice(re.lastIndex, i - 1) });
  }
  return blocks;
}

test('keyframes only animate transform and opacity', async () => {
  const files = await cssFiles();
  assert.ok(files.length > 0);
  let checked = 0;
  for (const file of files) {
    const css = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const { name, body } of keyframeBlocks(css)) {
      for (const [, prop] of body.matchAll(/([a-z-]+)\s*:/g)) {
        assert.ok(ALLOWED.has(prop), `${path.relative(ROOT, file)} @keyframes ${name} animates "${prop}"`);
      }
      checked++;
    }
  }
  assert.ok(checked > 0, 'found some keyframes to check');
});

test('every animation name used has a matching @keyframes', async () => {
  const css = (await Promise.all((await cssFiles()).map((f) => readFile(f, 'utf8')))).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const defined = new Set(keyframeBlocks(css).map((b) => b.name));
  const used = new Set();
  for (const [, value] of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    for (const token of value.split(/[\s,]+/)) {
      if (/^[a-z][\w-]*$/.test(token) && !KEYWORDS.has(token)) used.add(token);
    }
  }
  for (const name of used) assert.ok(defined.has(name), `animation "${name}" has no @keyframes`);
});

const KEYWORDS = new Set([
  'infinite', 'alternate', 'alternate-reverse', 'normal', 'reverse', 'forwards', 'backwards',
  'both', 'none', 'running', 'paused', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear',
  'step-start', 'step-end', 'steps', 'cubic-bezier', 'initial', 'inherit', 'unset',
]);
