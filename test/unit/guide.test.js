// GUIDE.md is the short guide. It must stay short, and every button, menu item and
// setting it tells you to click must exist in the app under exactly that name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_TOGGLE_SHORTCUT } from '../../src/core/shortcuts.js';

const read = (file) => readFile(new URL(`../../${file}`, import.meta.url), 'utf8');

/** Names from outside the app: GitHub's pages and Windows' own settings and warnings. */
const OUTSIDE_THE_APP = new Set([
  'Actions', 'CI', 'Run workflow', 'desktop-pet-windows', 'More info', 'Run anyway', '^', 'Settings', 'Apps', 'Uninstall',
]);

test('GUIDE.md stays short', async () => {
  const lines = (await read('GUIDE.md')).split('\n');
  assert.ok(lines.length <= 80, `${lines.length} lines; keep it to 80`);
  assert.ok(lines.every((l) => l.length <= 100), 'no very long lines');
});

test('every name GUIDE.md tells you to click exists in the app', async () => {
  const guide = await read('GUIDE.md');
  const ui = (await Promise.all([
    'src/main/tray-menu.js', 'src/renderer/settings-fields.js', 'src/renderer/settings.js', 'src/main/main.js',
  ].map(read))).join('\n');
  // Bold text is a name to look for, except headings, which end in ":" or "." (but a
  // name like "Settings..." ends in "...", and is checked).
  const heading = (n) => n.endsWith(':') || (n.endsWith('.') && !n.endsWith('...'));
  const names = [...guide.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1]).filter((n) => !heading(n));
  assert.ok(names.length > 10, 'the guide names the things to click');
  const missing = names.filter((name) => !OUTSIDE_THE_APP.has(name) && name !== DEFAULT_TOGGLE_SHORTCUT
    && !ui.includes(`'${name}'`) && !ui.includes(`"${name}"`));
  assert.deepEqual(missing, [], 'names in GUIDE.md that the app does not use');
  assert.ok(names.includes(DEFAULT_TOGGLE_SHORTCUT), 'the guide gives the real default shortcut');
  assert.ok(names.includes('Settings...') && names.includes('Add folder...'), 'names ending in "..." are checked too');
});

test('the README points to GUIDE.md near the top', async () => {
  const readme = (await read('README.md')).split('\n').slice(0, 15).join('\n');
  assert.match(readme, /\(GUIDE\.md\)/);
});
