import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShortcut, shortcutFromKeyEvent, DEFAULT_TOGGLE_SHORTCUT } from '../../src/core/shortcuts.js';

const ok = (text) => parseShortcut(text).shortcut;
const error = (text) => parseShortcut(text).error;

test('the default shortcut is valid and already in the standard form', () => {
  assert.equal(ok(DEFAULT_TOGGLE_SHORTCUT), DEFAULT_TOGGLE_SHORTCUT);
});

test('shortcuts are written one standard way, whatever the spelling or order of modifiers', () => {
  assert.equal(ok('ctrl+alt+p'), 'Ctrl+Alt+P');
  assert.equal(ok('Alt+Control+P'), 'Ctrl+Alt+P');
  assert.equal(ok(' Shift + Ctrl + f5 '), 'Ctrl+Shift+F5');
  assert.equal(ok('CmdOrCtrl+Shift+H'), 'CommandOrControl+Shift+H');
  assert.equal(ok('Meta+Space'), 'Super+Space');
  assert.equal(ok('Option+Esc'), 'Alt+Escape');
  assert.equal(ok('Ctrl+Alt+Return'), 'Ctrl+Alt+Enter');
  assert.equal(ok('Ctrl+Alt+Plus'), 'Ctrl+Alt+Plus');
  assert.equal(ok('Ctrl+Alt++'), 'Ctrl+Alt+Plus');
  assert.equal(ok('Ctrl+Alt+/'), 'Ctrl+Alt+/');
  assert.equal(ok('Ctrl+Alt+F24'), 'Ctrl+Alt+F24');
  assert.equal(ok('Ctrl+Ctrl+P'), 'Ctrl+P', 'a repeated modifier counts once');
});

test('shortcuts that would get in the way of typing, or that make no sense, are refused', () => {
  assert.match(error('P'), /needs Ctrl, Alt or the Windows key/);
  assert.match(error('Shift+P'), /needs Ctrl, Alt or the Windows key/);
  assert.match(error('Ctrl+Alt'), /needs a key/);
  assert.match(error('Ctrl+P+Q'), /only have one key/);
  assert.match(error('P+Ctrl'), /modifiers .* before the key/);
  assert.match(error('Ctrl+Alt+Banana'), /doesn't know: "Banana"/);
  assert.match(error('Ctrl+Alt+F25'), /doesn't know/);
  assert.match(error('Ctrl++P'), /isn't a shortcut like/);
  assert.match(error(''), /is empty/);
  assert.match(error('   '), /is empty/);
  assert.match(error(42), /is empty/);
  assert.match(error(null), /is empty/);
  assert.match(error(`Ctrl+${'A'.repeat(200)}`), /too long/);
});

const press = (code, mods = {}) => shortcutFromKeyEvent({
  code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods,
});

test('a key press becomes a shortcut, using the physical key', () => {
  assert.deepEqual(press('KeyP', { ctrlKey: true, altKey: true }), { shortcut: 'Ctrl+Alt+P' });
  assert.deepEqual(press('Digit1', { ctrlKey: true, shiftKey: true }), { shortcut: 'Ctrl+Shift+1' },
    'Shift+1 stays "1", not "!"');
  assert.deepEqual(press('Numpad7', { altKey: true }), { shortcut: 'Alt+7' });
  assert.deepEqual(press('F9', { metaKey: true }), { shortcut: 'Super+F9' });
  assert.deepEqual(press('Slash', { ctrlKey: true, altKey: true }), { shortcut: 'Ctrl+Alt+/' });
  assert.deepEqual(press('ArrowUp', { ctrlKey: true, altKey: true }), { shortcut: 'Ctrl+Alt+Up' });
  assert.deepEqual(press('Space', { ctrlKey: true, altKey: true }), { shortcut: 'Ctrl+Alt+Space' });
});

test('modifiers on their own give nothing yet; unsafe or unknown presses are refused', () => {
  for (const code of ['ControlLeft', 'AltRight', 'ShiftLeft', 'MetaLeft', 'CapsLock', 'Fn', '']) {
    assert.equal(press(code, { ctrlKey: true }), null, code);
  }
  assert.match(press('KeyP').error, /needs Ctrl, Alt or the Windows key/);
  assert.match(press('KeyP', { shiftKey: true }).error, /needs Ctrl, Alt or the Windows key/);
});
