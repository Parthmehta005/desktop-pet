// One way in for every event the pet reacts to. Sources (Claude hooks, file watchers,
// the idle and app monitors) emit here; "Pause reactions" stops all of them except the
// tray's test reactions and the battery (a low battery beats everything, even a pause).
// Pure, so it can be unit tested.

/**
 * @param {(event: object) => void} deliver  Sends an engine event to the pet.
 */
export function createEventBus(deliver) {
  let paused = false;
  return {
    /** @param {{ source?: string }} [options]  'test' and 'battery' events get through while paused. */
    emit(event, { source = 'app' } = {}) {
      if (paused && source !== 'test' && source !== 'battery') return false;
      deliver(event);
      return true;
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      // Calm the pet straight away rather than leaving it mid-reaction.
      if (paused) deliver({ type: 'reset' });
    },
    get paused() {
      return paused;
    },
  };
}
