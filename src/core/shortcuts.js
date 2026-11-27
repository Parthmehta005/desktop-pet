/**
 * Keyboard shortcuts in Electron's accelerator format ("Ctrl+Alt+P"): checking them,
 * writing them one standard way, and turning a key press into one. Pure.
 *
 * A shortcut is one or more modifiers and one key, joined with "+". It must use Ctrl,
 * Alt or Super (Windows key): Shift alone, or no modifier at all, would steal keys from
 * whatever you're typing in, since the shortcut works in every app.
 */

/** Modifier spellings Electron accepts -> the one we store. */
const MODIFIER_NAMES = Object.freeze({
  ctrl: 'Ctrl',
  control: 'Ctrl',
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  command: 'Command',
  cmd: 'Command',
  alt: 'Alt',
  option: 'Alt',
  altgr: 'AltGr',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
});

/** Modifiers that make a shortcut safe to grab everywhere (Shift alone isn't). */
const STRONG_MODIFIERS = new Set(['Ctrl', 'CommandOrControl', 'Command', 'Alt', 'AltGr', 'Super']);

/** The order modifiers are written in. */
const MODIFIER_ORDER = ['CommandOrControl', 'Command', 'Ctrl', 'Alt', 'AltGr', 'Shift', 'Super'];

/** Named keys Electron accepts -> the one we store. */
const NAMED_KEYS = Object.freeze({
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  return: 'Enter',
  enter: 'Enter',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  escape: 'Escape',
  esc: 'Escape',
  plus: 'Plus',
  printscreen: 'PrintScreen',
});

/** Punctuation keys (unshifted, US layout) Electron accepts as they are. */
const PUNCTUATION = new Set([',', '-', '.', '/', ';', "'", '[', ']', '\\', '=', '`']);

export const DEFAULT_TOGGLE_SHORTCUT = 'Ctrl+Alt+P';

function normalizeKey(raw) {
  if (/^[a-z0-9]$/i.test(raw)) return raw.toUpperCase();
  const f = raw.match(/^f([1-9]|1[0-9]|2[0-4])$/i);
  if (f) return `F${f[1]}`;
  if (PUNCTUATION.has(raw)) return raw;
  return NAMED_KEYS[raw.toLowerCase()] ?? null;
}

/**
 * Reads a shortcut.
 * @returns {{ shortcut: string } | { error: string }}  `shortcut` in the standard form.
 */
export function parseShortcut(text) {
  if (typeof text !== 'string' || text.trim() === '') return { error: 'is empty' };
  if (text.length > 100) return { error: 'is too long' };
  // "Ctrl+Alt+Plus" or "Ctrl+Alt++" both mean the + key; split on the "+" between parts.
  const parts = text.trim().replace(/\+\+$/, '+Plus').split('+').map((p) => p.trim());
  if (parts.some((p) => p === '')) return { error: `isn't a shortcut like "${DEFAULT_TOGGLE_SHORTCUT}"` };
  const modifiers = new Set();
  let key = null;
  for (const part of parts) {
    const modifier = MODIFIER_NAMES[part.toLowerCase()];
    if (modifier) {
      if (key !== null) return { error: 'must put the modifiers (Ctrl, Alt, Shift...) before the key' };
      modifiers.add(modifier);
      continue;
    }
    if (key !== null) return { error: 'can only have one key besides Ctrl, Alt, Shift or Super' };
    key = normalizeKey(part);
    if (key === null) return { error: `uses a key the app doesn't know: "${part}"` };
  }
  if (key === null) return { error: 'needs a key as well as Ctrl, Alt, Shift or Super' };
  if (![...modifiers].some((m) => STRONG_MODIFIERS.has(m))) {
    return { error: 'needs Ctrl, Alt or the Windows key, so it never gets in the way of typing' };
  }
  const ordered = MODIFIER_ORDER.filter((m) => modifiers.has(m));
  return { shortcut: [...ordered, key].join('+') };
}

/** Physical keys (KeyboardEvent.code) for punctuation, so Shift doesn't change them. */
const CODE_KEYS = Object.freeze({
  Comma: ',',
  Minus: '-',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Equal: '=',
  Backquote: '`',
  Space: 'Space',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Escape: 'Escape',
  PrintScreen: 'PrintScreen',
});

/**
 * The shortcut for a key press in the settings window, or null while only modifiers are
 * held. Uses the physical key, so Shift+1 is "Shift+1", not "!", on any layout.
 *
 * @param {{ code: string, ctrlKey: boolean, altKey: boolean, shiftKey: boolean, metaKey: boolean }} event
 * @returns {{ shortcut: string } | { error: string } | null}
 */
export function shortcutFromKeyEvent(event) {
  const code = String(event.code ?? '');
  let key;
  const letter = code.match(/^Key([A-Z])$/);
  const digit = code.match(/^(?:Digit|Numpad)([0-9])$/);
  const fn = code.match(/^F([1-9]|1[0-9]|2[0-4])$/);
  if (letter) key = letter[1];
  else if (digit) key = digit[1];
  else if (fn) key = `F${fn[1]}`;
  else key = CODE_KEYS[code] ?? null;
  if (key === null) return null; // a modifier on its own, or a key we can't use
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');
  return parseShortcut([...parts, key].join('+'));
}
