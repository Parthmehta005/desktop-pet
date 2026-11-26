/**
 * The pet's moods and modifiers.
 *
 * A *mood* is what the pet is doing right now; exactly one mood is active at a time and
 * the engine picks it by `priority` (higher wins). A *modifier* changes how that mood is
 * presented (still and translucent in a meeting, invisible when hidden) without replacing it.
 *
 * Fields:
 *   label        Short human-readable name (gallery, settings).
 *   trigger      What makes the pet enter this mood (gallery captions, docs).
 *   priority     Unique number; the highest-priority applicable mood wins.
 *   durationMs   How long a timed mood lasts once triggered, or null if it lasts as long
 *                as its condition holds.
 *   speed        Walking-speed multiplier: 1 = normal wander, 0 = stays put.
 *   bubble       Speech-bubble text shown when the mood starts, or null.
 *   bubbleEveryMs  For long-lasting moods, repeat the bubble at most this often.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function define(moods) {
  for (const [id, def] of Object.entries(moods)) {
    moods[id] = Object.freeze({ id, bubble: null, bubbleEveryMs: null, durationMs: null, ...def });
  }
  return Object.freeze(moods);
}

export const MOODS = define({
  wander: {
    label: 'Wandering',
    trigger: 'Nothing else is going on',
    priority: 0,
    speed: 1,
  },
  focused: {
    label: 'Focused',
    trigger: 'You edited files in a watched repo in the last 2 minutes',
    priority: 20,
    speed: 0,
  },
  bedtime: {
    label: 'Bedtime',
    trigger: 'You are still active after bedtime',
    priority: 30,
    speed: 0.5,
    bubble: 'Bed?',
    bubbleEveryMs: 10 * MINUTE,
  },
  stretch: {
    label: 'Stretch break',
    trigger: 'You have been active a long time without a break',
    priority: 31,
    durationMs: 12 * SECOND,
    speed: 0,
    bubble: 'Break?',
  },
  watching: {
    label: 'Watching',
    trigger: 'A video site or player is in the foreground',
    priority: 40,
    speed: 0,
  },
  gaming: {
    label: 'Gaming',
    trigger: 'A game is in the foreground',
    priority: 41,
    speed: 0,
  },
  vibing: {
    label: 'Vibing',
    trigger: 'A music app is in the foreground',
    priority: 42,
    speed: 0,
  },
  greeting: {
    label: 'Greeting',
    trigger: 'The app started, or you came back',
    priority: 45,
    durationMs: 3 * SECOND,
    speed: 0,
    bubble: 'Hi!',
  },
  sleeping: {
    label: 'Sleeping',
    trigger: 'You are idle or the screen is locked',
    priority: 50,
    speed: 0,
  },
  'away-done': {
    label: 'Done while you were away',
    trigger: 'Claude finished while you were idle',
    priority: 60,
    speed: 0,
    bubble: 'Done!',
  },
  working: {
    label: 'Working hard',
    trigger: 'Claude Code is working in a watched folder',
    priority: 70,
    speed: 0,
  },
  happy: {
    label: 'Happy',
    trigger: 'Claude finished a task',
    priority: 80,
    durationMs: 8 * SECOND,
    speed: 0,
    bubble: 'Done!',
  },
  celebrating: {
    label: 'Celebrating',
    trigger: 'A new commit landed in a watched repo',
    priority: 81,
    durationMs: 4 * SECOND,
    speed: 0,
    bubble: 'Commit!',
  },
  alert: {
    label: 'Needs you',
    trigger: 'Claude is waiting for your permission or answer',
    priority: 90,
    speed: 0,
    bubble: 'Need you!',
    bubbleEveryMs: 2 * MINUTE,
  },
  petted: {
    label: 'Petted',
    trigger: 'You clicked the pet',
    priority: 100,
    durationMs: 2 * SECOND,
    speed: 0,
  },
  falling: {
    label: 'Falling',
    trigger: 'You dropped the pet',
    priority: 105,
    speed: 0,
  },
  held: {
    label: 'Held',
    trigger: 'You are dragging the pet',
    priority: 110,
    speed: 0,
  },
});

export const MOOD_IDS = Object.freeze(Object.keys(MOODS));

export const MODIFIERS = Object.freeze({
  meeting: Object.freeze({
    id: 'meeting',
    label: 'Meeting mode',
    trigger: 'A meeting app is in the foreground',
    opacity: 0.5,
    showBubbles: false,
    still: true,
  }),
  hidden: Object.freeze({
    id: 'hidden',
    label: 'Hidden',
    trigger: 'An app is fullscreen',
    opacity: 0,
    showBubbles: false,
    still: true,
  }),
});

export const MODIFIER_IDS = Object.freeze(Object.keys(MODIFIERS));

/**
 * Every state that has its own animation: all moods plus the meeting look.
 * (`hidden` has no animation; the pet simply isn't drawn.)
 */
export const ANIMATION_STATE_IDS = Object.freeze([...MOOD_IDS, 'meeting']);

/** Moods an app rule can map a foreground window to. */
export const APP_RULE_MOODS = Object.freeze(['vibing', 'gaming', 'watching', 'meeting']);

/** Highest sweat level; 3 or more busy Claude sessions all look the same. */
export const MAX_INTENSITY = 3;

export function intensityFor(sessionCount) {
  if (!Number.isFinite(sessionCount) || sessionCount < 1) return 1;
  return Math.min(MAX_INTENSITY, Math.floor(sessionCount));
}

/**
 * How a mood result from the engine should be presented: walking speed multiplier,
 * opacity and whether speech bubbles may appear. Modifiers override the mood.
 *
 * @param {{ mood: string, modifiers?: { meeting?: boolean, hidden?: boolean } }} result
 */
export function presentation(result) {
  const def = MOODS[result.mood] ?? MOODS.wander;
  let speed = def.speed;
  let opacity = 1;
  let showBubbles = true;
  for (const id of MODIFIER_IDS) {
    if (!result.modifiers?.[id]) continue;
    const mod = MODIFIERS[id];
    if (mod.still) speed = 0;
    opacity = Math.min(opacity, mod.opacity);
    showBubbles = showBubbles && mod.showBubbles;
  }
  return { speed, opacity, showBubbles };
}
