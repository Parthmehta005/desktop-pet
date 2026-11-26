import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APP_RULES, validateRule, compileRules, matchApp, processBaseName,
} from '../../src/core/app-rules.js';

const defaults = compileRules(DEFAULT_APP_RULES).compiled;
const mood = (app) => matchApp(defaults, app);

test('the default rules are all valid', () => {
  const { compiled, errors } = compileRules(DEFAULT_APP_RULES);
  assert.deepEqual(errors, []);
  assert.equal(compiled.length, DEFAULT_APP_RULES.length);
});

test('processBaseName strips the directory and .exe', () => {
  assert.equal(processBaseName('C:\\Program Files\\Spotify\\Spotify.exe'), 'Spotify');
  assert.equal(processBaseName('ms-teams.EXE'), 'ms-teams');
  assert.equal(processBaseName('/usr/bin/vlc'), 'vlc');
  assert.equal(processBaseName('Code'), 'Code');
  assert.equal(processBaseName(undefined), '');
});

test('default rules: music', () => {
  assert.equal(mood({ process: 'Spotify', title: 'Spotify Premium' }), 'vibing');
  assert.equal(mood({ process: 'Spotify.exe', title: 'Artist - Song' }), 'vibing');
  assert.equal(mood({ process: 'chrome', title: 'Chill Mix - YouTube Music - Google Chrome' }), 'vibing',
    'YouTube Music is music, not video');
});

test('default rules: meetings need a meeting window, not just the app', () => {
  assert.equal(mood({ process: 'Zoom', title: 'Zoom Meeting' }), 'meeting');
  assert.equal(mood({ process: 'Zoom', title: 'Zoom Workplace' }), null, 'the Zoom home screen is not a meeting');
  assert.equal(mood({ process: 'ms-teams', title: 'Meeting with Sam | Microsoft Teams' }), 'meeting');
  assert.equal(mood({ process: 'ms-teams', title: 'Chat | Microsoft Teams' }), null);
  assert.equal(mood({ process: 'msedge', title: 'Meet - abc-defg-hij - Microsoft Edge' }), 'meeting');
});

test('default rules: games by install folder or title', () => {
  assert.equal(mood({ process: 'game', path: 'D:\\SteamLibrary\\steamapps\\common\\Some Game\\game.exe' }), 'gaming');
  assert.equal(mood({ process: 'x', path: 'C:\\Program Files\\Epic Games\\Thing\\x.exe' }), 'gaming');
  assert.equal(mood({ process: 'javaw', title: 'Minecraft 1.21' }), 'gaming');
  assert.equal(mood({ process: 'steam', path: 'C:\\Program Files (x86)\\Steam\\steam.exe' }), null,
    'the Steam store itself is not a game');
});

test('default rules: video', () => {
  assert.equal(mood({ process: 'chrome', title: 'Cats - YouTube - Google Chrome' }), 'watching');
  assert.equal(mood({ process: 'firefox', title: 'Netflix — Mozilla Firefox' }), 'watching');
  assert.equal(mood({ process: 'vlc', title: 'movie.mkv - VLC media player' }), 'watching');
  assert.equal(mood({ process: 'msedge', title: 'Disney+ | Movies' }), 'watching');
});

test('default rules: ordinary work apps match nothing', () => {
  assert.equal(mood({ process: 'Code', title: 'engine.js - desktop-pet - Visual Studio Code' }), null);
  assert.equal(mood({ process: 'WindowsTerminal', title: 'claude' }), null);
  assert.equal(mood({}), null);
  assert.equal(matchApp(defaults, null), null);
});

test('a rule with several fields needs all of them to match', () => {
  const { compiled } = compileRules([{ process: '^chrome$', title: 'Figma', mood: 'vibing' }]);
  assert.equal(matchApp(compiled, { process: 'chrome', title: 'Figma - Design' }), 'vibing');
  assert.equal(matchApp(compiled, { process: 'chrome', title: 'Docs' }), null);
  assert.equal(matchApp(compiled, { process: 'firefox', title: 'Figma' }), null);
});

test('rules are case-insensitive and first match wins', () => {
  const { compiled } = compileRules([
    { title: 'lofi', mood: 'vibing' },
    { title: 'youtube', mood: 'watching' },
  ]);
  assert.equal(matchApp(compiled, { title: 'LOFI radio - YOUTUBE' }), 'vibing');
});

test('validateRule rejects unusable rules with a message', () => {
  assert.equal(validateRule({ process: 'x', mood: 'vibing' }), null);
  assert.match(validateRule(null), /object/);
  assert.match(validateRule([]), /object/);
  assert.match(validateRule({ process: 'x', mood: 'sleeping' }), /mood must be one of/);
  assert.match(validateRule({ mood: 'gaming' }), /at least one of/);
  assert.match(validateRule({ process: '', title: '', mood: 'gaming' }), /at least one of/);
  assert.match(validateRule({ title: 42, mood: 'gaming' }), /title must be text/);
  assert.match(validateRule({ title: '(unclosed', mood: 'gaming' }), /not a valid regular expression/);
  assert.match(validateRule({ title: 'x'.repeat(501), mood: 'gaming' }), /longer than 500/);
  assert.match(validateRule({ name: 3, title: 'x', mood: 'gaming' }), /name must be text/);
});

test('compileRules skips invalid rules and reports them by index', () => {
  const { compiled, errors } = compileRules([
    { title: 'ok', mood: 'vibing' },
    { title: '[bad', mood: 'vibing' },
    'nonsense',
  ]);
  assert.equal(compiled.length, 1);
  assert.deepEqual(errors.map((e) => e.index), [1, 2]);
  assert.deepEqual(compileRules(undefined), { compiled: [], errors: [] });
});
