/**
 * Turning a Claude Code hook payload into a pet event, and deciding which sessions count.
 *
 * Claude Code sends each hook a JSON payload on stdin; the installed command forwards it
 * unchanged. The fields used here are:
 *   hook_event_name    'UserPromptSubmit', 'PostToolUse', 'Stop', ...
 *   session_id         which Claude session
 *   cwd                the session's working folder
 *   notification_type  for Notification hooks (newer Claude Code versions)
 *   message            for Notification hooks
 *
 * Which sessions count:
 *   - No watched folders configured: every session (so a fresh install just works).
 *   - Watched folders configured: only sessions whose cwd is inside one of them,
 *     unless "react to all Claude sessions" is on.
 */

import { findContainingFolder } from './paths.js';

/** Hooks the engine understands. */
export const HOOK_EVENTS = Object.freeze([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SubagentStop', 'SessionEnd',
]);

/** Hooks the installer adds to Claude Code's settings. */
export const INSTALLED_HOOK_EVENTS = Object.freeze([
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd',
]);

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : undefined);

/**
 * @param {unknown} payload
 * @param {{ watchedFolders?: string[], reactToAllSessions?: boolean }} config
 * @returns {{ event: object, folder: string | null } | { ignored: string }}
 */
export function hookToEvent(payload, { watchedFolders = [], reactToAllSessions = false } = {}) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return { ignored: 'not an object' };
  const hook = payload.hook_event_name;
  if (!HOOK_EVENTS.includes(hook)) return { ignored: `unknown hook ${String(hook).slice(0, 50)}` };

  const cwd = text(payload.cwd, 4096);
  const folder = cwd ? findContainingFolder(cwd, watchedFolders) : null;
  const filtering = watchedFolders.length > 0 && !reactToAllSessions;
  if (filtering && folder === null) return { ignored: 'outside watched folders' };

  const event = { type: 'claude', hook, sessionId: text(payload.session_id, 200) ?? '' };
  const notificationType = text(payload.notification_type, 100);
  const message = text(payload.message, 500);
  if (notificationType !== undefined) event.notificationType = notificationType;
  if (message !== undefined) event.message = message;
  return { event, folder };
}
