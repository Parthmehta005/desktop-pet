// The preview stage: the real controller running on a pretend desktop, with buttons for
// every event the desktop app reacts to and a clock you can speed up.
//
// Query parameters: pet=<id>, speed=<1|10|60|600|3600>, wallpaper=dark, time=HH:MM (start the
// clock at that time today; tests use it so results don't depend on when they run)
import { PET_DEFINITIONS, getPet } from '../src/renderer/pets/index.js';
import { createController } from '../src/renderer/controller.js';
import { MOODS } from '../src/core/moods.js';

const stage = document.getElementById('stage');
const strip = document.getElementById('strip');
const desktop = document.querySelector('.desktop');
const controls = document.getElementById('controls');
const params = new URLSearchParams(location.search);

// ---------- A clock that can run fast, or jump to the middle of the night ----------

const clock = {
  base: Date.now(),
  realBase: performance.now(),
  scale: 1,
  now() {
    return this.base + (performance.now() - this.realBase) * this.scale;
  },
  setScale(scale) {
    this.base = this.now();
    this.realBase = performance.now();
    this.scale = scale;
  },
  setTime(ms) {
    this.base = ms;
    this.realBase = performance.now();
  },
};

const startTime = (params.get('time') ?? '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
if (startTime) {
  const start = new Date();
  start.setHours(Number(startTime[1]), Number(startTime[2]), 0, 0);
  clock.setTime(start.getTime());
}

const SPEEDS = [1, 10, 60, 600, 3600];
const startSpeed = Number(params.get('speed'));
if (SPEEDS.includes(startSpeed)) clock.setScale(startSpeed);

const controller = createController({
  strip,
  pet: getPet(params.get('pet') ?? 'cat'),
  now: () => clock.now(),
});
const send = (event) => controller.dispatch(event);

// ---------- Pretend "you": idle time is polled like the real idle monitor ----------

const you = { away: false, awaySince: 0 };
setInterval(() => {
  const seconds = you.away ? Math.max(0, (clock.now() - you.awaySince) / 1000) : 0;
  send({ type: 'idle-time', seconds });
}, 500);

// ---------- Pretend Claude Code sessions ----------

const sessions = [];
let nextSession = 1;
const current = () => sessions.at(-1) ?? 's1';
const claude = (hook, sessionId, extra = {}) => send({ type: 'claude', hook, sessionId, ...extra });

function startSession(id = `s${nextSession++}`) {
  if (!sessions.includes(id)) sessions.push(id);
  claude('UserPromptSubmit', id);
}

function finishSession(id) {
  claude('Stop', id);
  sessions.splice(sessions.indexOf(id), 1);
}

const app = (process, title, extra = {}) => () => send({ type: 'app', process, title, ...extra });

// ---------- Buttons ----------

const GROUPS = [
  ['Claude Code', [
    ['claude-start', 'Start working', () => { if (!sessions.length) nextSession = 2; startSession('s1'); }],
    ['claude-another', 'Start another session', () => startSession()],
    ['claude-permission', 'Ask for permission', () => claude('Notification', current(), {
      notificationType: 'permission_prompt', message: 'Claude needs your permission to use Bash',
    })],
    ['claude-tool', 'Tool finished', () => claude('PostToolUse', current())],
    ['claude-stop', 'Claude finished', () => (sessions.length ? finishSession(current()) : claude('Stop', 's1'))],
    ['claude-stop-all', 'All sessions finished', () => [...sessions].forEach(finishSession)],
    ['claude-end', 'End session', () => { claude('SessionEnd', current()); sessions.pop(); }],
  ]],
  ['You', [
    ['user-idle', 'Go idle', () => { if (!you.away) Object.assign(you, { away: true, awaySince: clock.now() }); }],
    ['user-back', 'Come back', () => { you.away = false; send({ type: 'idle-time', seconds: 0 }); }],
    ['user-lock', 'Lock screen', () => send({ type: 'lock' })],
    ['user-unlock', 'Unlock', () => { you.away = false; send({ type: 'unlock' }); }],
    ['app-start', 'Restart the pet', () => send({ type: 'app-start' })],
  ]],
  ['Coding', [
    ['file-edit', 'Edit a file', () => send({ type: 'file-activity', folder: 'C:\\code\\my-app' })],
    ['commit', 'Commit', () => send({ type: 'commit', folder: 'C:\\code\\my-app' })],
  ]],
  ['Apps', [
    ['app-music', 'Spotify', app('Spotify', 'Spotify Premium')],
    ['app-meeting', 'Zoom meeting', app('Zoom', 'Zoom Meeting')],
    ['app-game', 'Steam game', app('game', 'Some Game', { path: 'D:\\SteamLibrary\\steamapps\\common\\Some Game\\game.exe' })],
    ['app-video', 'YouTube', app('chrome', 'Lo-fi beats - YouTube - Google Chrome')],
    ['app-fullscreen', 'Fullscreen game', app('game', 'Some Game', { path: 'D:\\SteamLibrary\\steamapps\\common\\Some Game\\game.exe', fullscreen: true })],
    ['app-editor', 'Back to the editor', app('Code', 'main.js - my-app - Visual Studio Code')],
  ]],
  ['Pet', [
    ['pet', 'Pet it', () => send({ type: 'pet' })],
  ]],
];

for (const [title, buttons] of GROUPS) {
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = title;
  fieldset.append(legend);
  for (const [action, label, run] of buttons) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.textContent = label;
    button.addEventListener('click', run);
    fieldset.append(button);
  }
  controls.append(fieldset);
}

// ---------- Settings: pet, wallpaper, time ----------

function select(name, label, options, value, onChange) {
  const wrap = document.createElement('span');
  wrap.className = 'setting';
  const lbl = document.createElement('label');
  lbl.htmlFor = `stage-${name}`;
  lbl.textContent = label;
  const el = document.createElement('select');
  el.id = `stage-${name}`;
  for (const [v, text] of options) {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = text;
    option.selected = String(v) === String(value);
    el.append(option);
  }
  el.addEventListener('change', () => onChange(el.value));
  wrap.append(lbl, el);
  return wrap;
}

const settings = document.createElement('fieldset');
const settingsLegend = document.createElement('legend');
settingsLegend.textContent = 'Stage';
settings.append(
  settingsLegend,
  select('pet', 'Pet', Object.values(PET_DEFINITIONS).map((p) => [p.id, `${p.name} (${p.species})`]), controller.snapshot().pet,
    (id) => controller.setPet(getPet(id))),
  select('wallpaper', 'Wallpaper', [['light', 'Light'], ['dark', 'Dark']], params.get('wallpaper') === 'dark' ? 'dark' : 'light',
    (v) => { desktop.dataset.wallpaper = v; }),
  select('speed', 'Time speed', SPEEDS.map((s) => [s, s === 1 ? 'Real time' : s === 60 ? '1 minute per second' : s === 3600 ? '1 hour per second' : `${s}x`]), clock.scale,
    (v) => clock.setScale(Number(v))),
  select('clock', 'Clock', [['now', 'Now'], ['night', 'Night (00:45)']], 'now', (v) => {
    if (v === 'night') {
      const night = new Date(clock.now());
      if (night.getHours() >= 1) night.setDate(night.getDate() + 1);
      night.setHours(0, 45, 0, 0);
      clock.setTime(night.getTime());
    } else {
      clock.setTime(Date.now());
    }
  }),
);
controls.append(settings);
desktop.dataset.wallpaper = params.get('wallpaper') === 'dark' ? 'dark' : 'light';

// ---------- Status ----------

const status = document.getElementById('status');
function updateStatus() {
  const s = controller.snapshot();
  const mods = Object.entries(s.modifiers).filter(([, on]) => on).map(([m]) => m);
  const time = new Date(clock.now()).toTimeString().slice(0, 5);
  const fields = {
    mood: `${MOODS[s.mood].label} (${s.mood})${s.mood === 'working' ? `, sweat level ${s.intensity}` : ''}`,
    animation: s.state,
    modifiers: mods.length ? mods.join(', ') : 'none',
    claude: `${s.claude.working} working, ${s.claude.waiting} waiting`,
    you: you.away ? 'away' : 'here',
    clock: `${time} (${clock.scale === 1 ? 'real time' : `${clock.scale}x`})`,
  };
  for (const [key, value] of Object.entries(fields)) {
    const el = status.querySelector(`[data-field="${key}"]`);
    if (el.textContent !== value) el.textContent = value;
  }
}
setInterval(updateStatus, 200);
updateStatus();

send({ type: 'app-start' });

// For tests and curious developers.
window.__stage = { controller, clock, sessions, you };
stage.dataset.ready = 'true';
