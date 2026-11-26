/**
 * The mood engine: a pure reducer that turns a stream of timestamped events into the
 * pet's current mood. It has no clock of its own: every call takes `now` (ms since the
 * epoch), so tests can drive it with a fake clock and the app can replay events.
 *
 *   let state = createEngineState(config, now);
 *   state = reduce(state, event, now);      // never mutates `state`
 *   selectMood(state, now);                 // -> { mood, intensity, modifiers, claude }
 *
 * Events (anything else is ignored):
 *
 *   { type: 'claude', hook, sessionId, notificationType?, message? }
 *       A Claude Code hook. `hook` is the hook event name, e.g. 'UserPromptSubmit',
 *       'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionStart',
 *       'SessionEnd'. Filtering by watched folder happens before the engine.
 *   { type: 'tick' }
 *       Time passed. Lets timed moods expire.
 */

import { MOODS, intensityFor } from './moods.js';

const MINUTE = 60 * 1000;

export const ENGINE_DEFAULTS = Object.freeze({
  workingStaleMinutes: 10,
  alertTimeoutMinutes: 30,
});

/** Sessions silent for this long are forgotten entirely. */
const SESSION_FORGET_MS = 24 * 60 * MINUTE;

function engineConfig(config) {
  const out = { ...ENGINE_DEFAULTS };
  for (const key of Object.keys(ENGINE_DEFAULTS)) {
    if (config?.[key] !== undefined) out[key] = config[key];
  }
  return Object.freeze(out);
}

export function createEngineState(config = {}, _now = 0) {
  return Object.freeze({
    config: engineConfig(config),
    // sessionId -> { status: 'working' | 'waiting' | 'idle', lastEventAt }
    sessions: Object.freeze({}),
    // timed mood id -> time (ms) at which it ends
    timers: Object.freeze({}),
  });
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
  startTimer(next, 'happy', now);
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
  };
  handler(next, event, now);
  forgetOldSessions(next, now);
  for (const [id, until] of Object.entries(next.timers)) {
    if (until <= now) delete next.timers[id];
  }
  next.sessions = Object.freeze(next.sessions);
  next.timers = Object.freeze(next.timers);
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
  return moods;
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
  return {
    mood,
    intensity: mood === 'working' ? intensityFor(claude.working) : 1,
    modifiers: { meeting: false, hidden: false },
    claude,
  };
}

/** A small stateful wrapper for callers that don't want to thread state themselves. */
export function createEngine(config = {}, now = 0) {
  let state = createEngineState(config, now);
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
