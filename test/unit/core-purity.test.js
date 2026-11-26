// src/core is shared by the Electron main process, the renderer and the browser
// preview page, so it must not depend on Node, Electron or the DOM. ESLint enforces
// the same rule; this test keeps it true even if the lint config changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const coreDir = fileURLToPath(new URL('../../src/core/', import.meta.url));

async function coreFiles() {
  try {
    const entries = await readdir(coreDir, { recursive: true });
    return entries.filter((f) => f.endsWith('.js')).map((f) => path.join(coreDir, f));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

const IMPORT_PATTERNS = [
  /^\s*import\s[^'"]*?['"]([^'"]+)['"]/gm, // import x from '...'
  /^\s*import\s*['"]([^'"]+)['"]/gm, // import '...'
  /^\s*export\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/gm, // export ... from '...'
  /\bimport\(\s*['"]([^'"]+)['"]/g, // dynamic import('...')
  /\brequire\(\s*['"]([^'"]+)['"]/g, // require('...')
];

const FORBIDDEN_GLOBALS = /\b(process|window|document|navigator|require|__dirname|Buffer)\b\s*[.([]/;

test('src/core only imports other src/core modules', async () => {
  for (const file of await coreFiles()) {
    const source = await readFile(file, 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const specifier = match[1];
        assert.ok(
          specifier.startsWith('./') || specifier.startsWith('../'),
          `${path.relative(coreDir, file)} imports "${specifier}"`,
        );
        const resolved = path.resolve(path.dirname(file), specifier);
        assert.ok(
          resolved.startsWith(coreDir),
          `${path.relative(coreDir, file)} imports "${specifier}" from outside src/core`,
        );
      }
    }
  }
});

test('src/core does not touch Node or browser globals', async () => {
  for (const file of await coreFiles()) {
    const source = await readFile(file, 'utf8');
    // Strip line and block comments so documentation can mention these names.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const match = code.match(FORBIDDEN_GLOBALS);
    assert.equal(match, null, `${path.relative(coreDir, file)} uses "${match?.[1]}"`);
  }
});
