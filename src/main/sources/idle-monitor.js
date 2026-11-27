// How long since you last touched the keyboard or mouse, and whether the screen is
// locked. Polls Electron's powerMonitor; `powerMonitor` and the timers are injectable
// so tests can drive it.

/** How often idle time is checked. */
export const IDLE_POLL_MS = 5000;

/**
 * @param {object} options
 * @param {{ getSystemIdleTime(): number, on(e: string, f: Function): void, off(e: string, f: Function): void }} options.powerMonitor
 * @param {(event: object) => void} options.emit
 */
export function createIdleMonitor({
  powerMonitor,
  emit,
  intervalMs = IDLE_POLL_MS,
  setInterval: startTimer = setInterval,
  clearInterval: stopTimer = clearInterval,
}) {
  let timer = null;
  const poll = () => emit({ type: 'idle-time', seconds: powerMonitor.getSystemIdleTime() });
  // Locking or sleeping the computer counts as stepping away; coming back as returning.
  const away = () => emit({ type: 'lock' });
  const back = () => emit({ type: 'unlock' });
  const listeners = [['lock-screen', away], ['unlock-screen', back], ['suspend', away], ['resume', back]];

  return {
    start() {
      if (timer !== null) return;
      poll();
      timer = startTimer(poll, intervalMs);
      for (const [event, fn] of listeners) powerMonitor.on(event, fn);
    },
    stop() {
      if (timer === null) return;
      stopTimer(timer);
      timer = null;
      for (const [event, fn] of listeners) powerMonitor.off(event, fn);
    },
    poll,
  };
}
