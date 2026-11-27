// The tray menu, as a plain Electron menu template. No Electron import, so it can be
// unit tested; tray.js turns it into a real menu.

const CLAUDE_TEST_SESSION = 'tray-test';
const claude = (hook, extra = {}) => ({ type: 'claude', hook, sessionId: CLAUDE_TEST_SESSION, ...extra });
const app = (process, title, extra = {}) => ({ type: 'app', process, title, ...extra });

/** Hand-fired reactions, for trying the pet out without Claude or other apps. */
export const TEST_REACTIONS = Object.freeze([
  { id: 'claude-working', label: 'Claude starts working', events: [claude('UserPromptSubmit')] },
  { id: 'claude-needs-you', label: 'Claude needs you', events: [claude('Notification', { notificationType: 'permission_prompt', message: 'Claude needs your permission to use Bash' })] },
  { id: 'claude-done', label: 'Claude finished', events: [claude('Stop')] },
  { id: 'file-edit', label: 'You edit a file', events: [{ type: 'file-activity' }] },
  { id: 'commit', label: 'You commit', events: [{ type: 'commit' }] },
  { id: 'sleep', label: 'You go idle', events: [{ type: 'idle-time', seconds: 24 * 60 * 60 }] },
  { id: 'wake', label: 'You come back', events: [{ type: 'idle-time', seconds: 0 }] },
  { id: 'music', label: 'Music is playing', events: [app('Spotify', 'Spotify Premium')] },
  { id: 'meeting', label: 'A meeting starts', events: [app('Zoom', 'Zoom Meeting')] },
  { id: 'game', label: 'A game starts', events: [app('game', 'Game', { path: 'C:\\SteamLibrary\\steamapps\\common\\Game\\game.exe' })] },
  { id: 'video', label: 'A video plays', events: [app('chrome', 'Video - YouTube - Google Chrome')] },
  { id: 'fullscreen', label: 'Something goes fullscreen', events: [app('game', 'Game', { fullscreen: true })] },
  { id: 'back-to-work', label: 'Back to work', events: [app('Code', 'Visual Studio Code')] },
  { id: 'pet', label: 'Pet the pet', events: [{ type: 'pet' }] },
].map((r) => Object.freeze(r)));

/**
 * The one-line Claude Code status shown in the tray.
 * @param {{ status: string, serverError: string | null }} hooks
 */
export function hooksStatusLabel({ status, serverError }) {
  if (serverError) return 'Claude Code: the pet can\'t listen (see settings)';
  return {
    installed: 'Claude Code: connected',
    outdated: 'Claude Code: hooks out of date',
    'not-installed': 'Claude Code: hooks not installed',
    'invalid-settings': "Claude Code: can't read its settings.json",
  }[status] ?? 'Claude Code: checking...';
}

/**
 * @param {{
 *   config: { pet: string },
 *   paused: boolean,
 *   pets: Array<{ id: string, name: string, species: string }>,
 *   hooks?: { status: string, serverError: string | null },
 * }} state
 * @param {{
 *   setPet(id: string): void, setPaused(paused: boolean): void, test(id: string): void,
 *   installHooks(): void, uninstallHooks(): void, quit(): void,
 * }} actions
 */
export function buildTrayMenu({ config, paused, pets, hooks = { status: 'unknown', serverError: null } }, actions) {
  return [
    { label: 'Desktop Pet', enabled: false },
    { type: 'separator' },
    { label: hooksStatusLabel(hooks), enabled: false },
    {
      label: 'Install Claude Code hooks',
      enabled: hooks.status !== 'installed' && hooks.status !== 'invalid-settings',
      click: () => actions.installHooks(),
    },
    {
      label: 'Remove Claude Code hooks',
      enabled: hooks.status === 'installed' || hooks.status === 'outdated',
      click: () => actions.uninstallHooks(),
    },
    { type: 'separator' },
    {
      label: 'Pet',
      submenu: pets.map((p) => ({
        label: `${p.name} (${p.species})`,
        type: 'radio',
        checked: config.pet === p.id,
        click: () => actions.setPet(p.id),
      })),
    },
    {
      label: 'Pause reactions',
      type: 'checkbox',
      checked: paused,
      click: () => actions.setPaused(!paused),
    },
    {
      label: 'Test reactions',
      submenu: TEST_REACTIONS.map((r) => ({ label: r.label, click: () => actions.test(r.id) })),
    },
    { type: 'separator' },
    { label: 'Quit Desktop Pet', click: () => actions.quit() },
  ];
}
