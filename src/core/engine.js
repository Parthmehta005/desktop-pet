/**
 * The mood engine: a pure reducer that turns a stream of timestamped events into the
 * pet's current mood. It has no clock of its own: every call takes `now` (ms since the
 * epoch), so tests can drive it with a fake clock and the app can replay events.
 *
 *   let state = createEngineState(config);    // config: already validated (config.js)
 *   state = reduce(state, event, now);      // never mutates `state`
 *   selectMood(state, now);                 // -> { mood, intensity, modifiers, claude }
 *
 * Events (anything else is ignored):
 *
 *   { type: 'claude', hook, sessionId, notificationType?, message? }
 *       A Claude Code hook. `hook` is the hook event name, e.g. 'UserPromptSubmit',
 *       'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionStart',
 *       'SessionEnd'. Filtering by watched folder happens before the engine.
 *   { type: 'idle-time', seconds }
 *       Seconds since the user's last keyboard or mouse input (polled every few seconds).
 *   { type: 'lock' }, { type: 'unlock' }
 *       The screen was locked / unlocked.
 *   { type: 'app-start' }
 *       The pet just launched.
 *   { type: 'file-activity', folder? }
 *       Files changed in a watched repo (already debounced by the watcher).
 *   { type: 'commit', folder? }
 *       A new commit landed in a watched repo.
 *   { type: 'app', process, title, path?, fullscreen? }
 *       The foreground window changed. Matched against the app rules.
 *   { type: 'config', config }
 *       Settings changed; `config` holds the changed keys.
 *   { type: 'battery', percent, charging, present }
 *       The battery: charge 0..100, whether it's charging (or plugged in), and whether
 *       the computer has one at all. A desktop PC sends present: false.
 *   { type: 'pet' }
 *       The user clicked the pet.
 *   { type: 'grab' }, { type: 'drop' }, { type: 'land' }
 *       The user picked the pet up, let go of it, and it reached the ground.
 *   { type: 'reset' }
 *       Forget everything the pet is reacting to (Claude sessions, timed moods, the
 *       foreground app, recent edits), e.g. when reactions are paused. What the user is
 *       doing (idle, locked) and the settings are kept.
 *   { type: 'tick' }
 *       Time passed. Lets timed moods expire.
 */

import { MOODS, intensityFor } from './moods.js';
import { DEFAULT_APP_RULES, compileRules, matchApp } from './app-rules.js';
import { inTimeWindow } from './time.js';

const MINUTE = 60 * 1000;

export const ENGINE_DEFAULTS = Object.freeze({
  idleMinutes: 5,
  workingStaleMinutes: 10,
  alertTimeoutMinutes: 30,
  quietDuringMeetings: true,
  hideWhenFullscreen: true,
  appRules: DEFAULT_APP_RULES,
  // Stretch reminder after this much activity with no break; 0 turns it off.
  breakReminderMinutes: 90,
  // Idle (or locked) for at least this long counts as a break.
  breakMinutes: 5,
  // Local "HH:MM" window for the bedtime nudge; null (or equal times) turns it off.
  bedtime: '00:30',
  wakeTime: '06:00',
  // Panic at or below this battery percentage while unplugged; 0 turns it off.
  lowBatteryPercent: 10,
});

const APP_MOODS = new Set(['vibing', 'gaming', 'watching']);

/** Sessions silent for this long are forgotten entirely. */
const SESSION_FORGET_MS = 24 * 60 * MINUTE;

/** File edits keep the pet `focused` for this long. */
export const FOCUS_WINDOW_MS = 2 * MINUTE;

function engineConfig(config) {
  const out = { ...ENGINE_DEFAULTS };
  for (const key of Object.keys(ENGINE_DEFAULTS)) {
    if (config?.[key] !== undefined) out[key] = config[key];
  }
  return Object.freeze(out);
}

export function createEngineState(config = {}) {
  const cfg = engineConfig(config);
  return Object.freeze({
    config: cfg,
    rules: compileRules(cfg.appRules).compiled,
    // The foreground window and the mood its rule gives (null if none).
    app: null,
    appMood: null,
    // sessionId -> { status: 'working' | 'waiting' | 'idle', lastEventAt }
    sessions: Object.freeze({}),
    // timed mood id -> time (ms) at which it ends
    timers: Object.freeze({}),
    user: Object.freeze({ idleSeconds: 0, locked: false, idle: false }),
    // Claude finished while the user was away; cleared when they come back.
    awayDone: false,
    // When files last changed in a watched repo, or null.
    lastFileActivityAt: null,
    // When the next stretch reminder is due, or null if no active streak is running.
    nextStretchAt: null,
    // null, 'held' or 'falling'.
    interaction: null,
    // The last battery report: { percent, charging, present }, or null before the first.
    battery: null,
  });
}

function breakIntervalMs(config) {
  const minutes = Number(config.breakReminderMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * MINUTE : null;
}

function startActiveStreak(next, now) {
  const interval = breakIntervalMs(next.config);
  next.nextStretchAt = interval === null ? null : now + interval;
}

function checkStretch(next, now) {
  if (next.nextStretchAt === null || next.user.idle || now < next.nextStretchAt) return;
  startTimer(next, 'stretch', now);
  startActiveStreak(next, now);
}

/**
 * What a Claude Code `Notification` hook means for the pet.
 *   'needs-input'  Claude is blocked on the user (permission prompt, question).
 *   'idle'         Claude finished a while ago and is just waiting for the next prompt.
 *   'other'        Anything else (e.g. auth success): ignore.
 */
export function classifyNotification({ notificationType, message } = {}) {
  const type = typeof notificationType === 'string' ? notificationType.toLowerCase() : '';
  if (type === 'permission_prompt' || type === 'elicitation_dialog') return 'needs-input';
  if (type === 'idle_prompt') return 'idle';
  if (type !== '') return 'other';
  // Older Claude Code versions send only a message.
  const text = typeof message === 'string' ? message.toLowerCase() : '';
  if (text.includes('waiting for your input')) return 'idle';
  return 'needs-input';
}

const WORKING_HOOKS = new Set(['UserPromptSubmit', 'PreToolUse', 'PostToolUse']);

function startTimer(next, moodId, now) {
  next.timers[moodId] = now + MOODS[moodId].durationMs;
}

function claudeFinished(next, now) {
  // Nobody is watching: hold the news until the user is back.
  if (next.user.idle) next.awayDone = true;
  else startTimer(next, 'happy', now);
}

function userReturned(next, now) {
  startTimer(next, 'greeting', now);
  if (next.awayDone) {
    next.awayDone = false;
    startTimer(next, 'happy', now);
  }
}

function setIdle(next, idle, now) {
  const wasIdle = next.user.idle;
  next.user.idle = idle;
  if (wasIdle && !idle) userReturned(next, now);
}

function onIdleTime(next, event, now) {
  const seconds = Number(event.seconds);
  if (!Number.isFinite(seconds) || seconds < 0) return;
  next.user.idleSeconds = seconds;
  setIdle(next, next.user.locked || seconds >= next.config.idleMinutes * 60, now);
  if (next.user.locked || seconds >= next.config.breakMinutes * 60) next.nextStretchAt = null;
  else if (next.nextStretchAt === null) startActiveStreak(next, now);
}

function onLock(next, _event, now) {
  next.user.locked = true;
  setIdle(next, true, now);
  next.nextStretchAt = null;
}

function onUnlock(next, _event, now) {
  next.user.locked = false;
  next.user.idleSeconds = 0;
  setIdle(next, false, now);
  startActiveStreak(next, now);
}

function onAppStart(next, _event, now) {
  startTimer(next, 'greeting', now);
  startActiveStreak(next, now);
}

function onFileActivity(next, _event, now) {
  next.lastFileActivityAt = now;
}

function onCommit(next, _event, now) {
  startTimer(next, 'celebrating', now);
}

function onApp(next, event) {
  const text = (v) => (typeof v === 'string' ? v : '');
  next.app = Object.freeze({
    process: text(event.process),
    title: text(event.title),
    path: text(event.path),
    fullscreen: event.fullscreen === true,
  });
  next.appMood = matchApp(next.rules, next.app);
}

function onConfig(next, event, now) {
  if (!event.config || typeof event.config !== 'object') return;
  const before = next.config;
  next.config = engineConfig({ ...before, ...event.config });
  if (next.config.appRules !== before.appRules) {
    next.rules = compileRules(next.config.appRules).compiled;
    next.appMood = next.app ? matchApp(next.rules, next.app) : null;
  }
  if (!next.user.locked) {
    setIdle(next, next.user.idleSeconds >= next.config.idleMinutes * 60, now);
  }
  if (next.config.breakReminderMinutes !== before.breakReminderMinutes && next.nextStretchAt !== null) {
    startActiveStreak(next, now);
  }
}

function onBattery(next, event) {
  const percent = Number(event.percent);
  if (!Number.isFinite(percent)) return;
  next.battery = Object.freeze({
    percent: Math.min(100, Math.max(0, percent)),
    charging: event.charging === true,
    present: event.present !== false,
  });
}

/** On battery, with one fitted, at or below the threshold (0 = never). */
export function batteryLow(state) {
  const { battery, config } = state;
  const threshold = Number(config.lowBatteryPercent);
  return Boolean(battery && battery.present && !battery.charging && threshold > 0 && battery.percent <= threshold);
}

function onPet(next, _event, now) {
  startTimer(next, 'petted', now);
}

function onGrab(next) {
  next.interaction = 'held';
}

function onDrop(next) {
  if (next.interaction === 'held') next.interaction = 'falling';
}

function onLand(next) {
  next.interaction = null;
}

function onReset(next) {
  next.sessions = {};
  next.timers = {};
  next.app = null;
  next.appMood = null;
  next.awayDone = false;
  next.lastFileActivityAt = null;
  next.interaction = null;
}

function onClaude(next, event, now) {
  const id = typeof event.sessionId === 'string' && event.sessionId !== '' ? event.sessionId : 'default';
  const prev = next.sessions[id];
  const set = (status) => { next.sessions[id] = Object.freeze({ status, lastEventAt: now }); };

  if (WORKING_HOOKS.has(event.hook)) {
    // A new prompt means the user has moved on from the last "Done!".
    if (event.hook === 'UserPromptSubmit') delete next.timers.happy;
    set('working');
  } else if (event.hook === 'Notification') {
    if (classifyNotification(event) === 'needs-input') set('waiting');
    else if (prev) set(prev.status);
  } else if (event.hook === 'Stop') {
    set('idle');
    claudeFinished(next, now);
  } else if (event.hook === 'SessionStart' || event.hook === 'SubagentStop') {
    set(prev?.status ?? 'idle');
  } else if (event.hook === 'SessionEnd') {
    delete next.sessions[id];
  }
}

function forgetOldSessions(next, now) {
  for (const [id, s] of Object.entries(next.sessions)) {
    if (now - s.lastEventAt > SESSION_FORGET_MS) delete next.sessions[id];
  }
}

const HANDLERS = {
  claude: onClaude,
  'idle-time': onIdleTime,
  lock: onLock,
  unlock: onUnlock,
  'app-start': onAppStart,
  'file-activity': onFileActivity,
  commit: onCommit,
  app: onApp,
  battery: onBattery,
  config: onConfig,
  pet: onPet,
  grab: onGrab,
  drop: onDrop,
  land: onLand,
  reset: onReset,
  tick: () => {},
};

/** Applies one event. Returns a new state; the input state is never modified. */
export function reduce(state, event, now) {
  const handler = event && typeof event === 'object' ? HANDLERS[event.type] : undefined;
  if (!handler || !Number.isFinite(now)) return state;
  const next = {
    ...state,
    sessions: { ...state.sessions },
    timers: { ...state.timers },
    user: { ...state.user },
  };
  handler(next, event, now);
  checkStretch(next, now);
  forgetOldSessions(next, now);
  for (const [id, until] of Object.entries(next.timers)) {
    if (until <= now) delete next.timers[id];
  }
  next.sessions = Object.freeze(next.sessions);
  next.timers = Object.freeze(next.timers);
  next.user = Object.freeze(next.user);
  return Object.freeze(next);
}

function claudeCounts(state, now) {
  const staleMs = state.config.workingStaleMinutes * MINUTE;
  const alertMs = state.config.alertTimeoutMinutes * MINUTE;
  let working = 0;
  let waiting = 0;
  for (const s of Object.values(state.sessions)) {
    const age = now - s.lastEventAt;
    if (s.status === 'working' && age < staleMs) working++;
    else if (s.status === 'waiting' && age < alertMs) waiting++;
  }
  return { working, waiting };
}

/** Every mood whose condition currently holds. `wander` always does. */
export function applicableMoods(state, now) {
  const moods = ['wander'];
  for (const [id, until] of Object.entries(state.timers)) {
    if (until > now) moods.push(id);
  }
  const claude = claudeCounts(state, now);
  if (claude.working > 0) moods.push('working');
  if (claude.waiting > 0) moods.push('alert');
  if (state.awayDone) moods.push('away-done');
  if (state.user.idle) moods.push('sleeping');
  if (state.lastFileActivityAt !== null && now - state.lastFileActivityAt < FOCUS_WINDOW_MS) {
    moods.push('focused');
  }
  if (APP_MOODS.has(state.appMood)) moods.push(state.appMood);
  if (!state.user.idle && inTimeWindow(now, state.config.bedtime, state.config.wakeTime)) {
    moods.push('bedtime');
  }
  if (state.interaction !== null) moods.push(state.interaction);
  if (batteryLow(state)) moods.push('low-battery');
  return moods;
}

function modifiersFor(state) {
  return {
    meeting: state.config.quietDuringMeetings && state.appMood === 'meeting',
    hidden: state.config.hideWhenFullscreen && state.app?.fullscreen === true,
  };
}

/**
 * The mood the pet should show now.
 *
 * @returns {{
 *   mood: string,
 *   intensity: number,
 *   modifiers: { meeting: boolean, hidden: boolean },
 *   claude: { working: number, waiting: number },
 * }}
 *   `intensity` is 1..3 for `working` (how many sessions are busy) and 1 otherwise.
 */
export function selectMood(state, now) {
  let mood = 'wander';
  for (const id of applicableMoods(state, now)) {
    if (MOODS[id].priority > MOODS[mood].priority) mood = id;
  }
  const claude = claudeCounts(state, now);
  // Low battery beats even a meeting or a fullscreen app.
  const modifiers = MOODS[mood].overridesModifiers ? { meeting: false, hidden: false } : modifiersFor(state);
  return {
    mood,
    intensity: mood === 'working' ? intensityFor(claude.working) : 1,
    modifiers,
    claude,
  };
}

/** A small stateful wrapper for callers that don't want to thread state themselves. */
export function createEngine(config = {}) {
  let state = createEngineState(config);
  return {
    dispatch(event, at) {
      state = reduce(state, event, at);
      return selectMood(state, at);
    },
    mood(at) {
      return selectMood(state, at);
    },
    get state() {
      return state;
    },
  };
}
