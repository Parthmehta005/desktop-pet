/** Local time-of-day helpers ("HH:MM", 24-hour). */

/** "HH:MM" -> minutes after midnight, or null if it isn't a valid time. */
export function parseTimeOfDay(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * True if the local time at `now` (ms since the epoch) is in [start, end). Windows may
 * wrap past midnight ("23:00" to "06:00"). Equal or invalid times mean "never".
 */
export function inTimeWindow(now, start, end) {
  const from = parseTimeOfDay(start);
  const to = parseTimeOfDay(end);
  if (from === null || to === null || from === to) return false;
  const d = new Date(now);
  const minute = d.getHours() * 60 + d.getMinutes();
  return from < to ? minute >= from && minute < to : minute >= from || minute < to;
}
