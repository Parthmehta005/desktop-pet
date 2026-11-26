// A fake-clock driver for the engine, so tests read like a timeline:
//   const h = harness(); h.claude('UserPromptSubmit'); h.advance(5000); h.mood() === 'working'
import { createEngine } from '../../../src/core/engine.js';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;

/** 2:00 pm local time: daytime, so bedtime never applies unless a test asks for it. */
export const T0 = new Date(2026, 10, 26, 14, 0, 0).getTime();

export function harness(config = {}, start = T0) {
  let now = start;
  const engine = createEngine(config, now);
  const h = {
    get now() { return now; },
    get state() { return engine.state; },
    send(event) {
      engine.dispatch(event, now);
      return h;
    },
    /** Moves the clock forward, sending a tick so timed moods can expire. */
    advance(ms) {
      now += ms;
      return h.send({ type: 'tick' });
    },
    claude(hook, sessionId = 's1', extra = {}) {
      return h.send({ type: 'claude', hook, sessionId, ...extra });
    },
    permission(sessionId = 's1') {
      return h.claude('Notification', sessionId, {
        notificationType: 'permission_prompt',
        message: 'Claude needs your permission to use Bash',
      });
    },
    result() { return engine.mood(now); },
    mood() { return engine.mood(now).mood; },
  };
  return h;
}
