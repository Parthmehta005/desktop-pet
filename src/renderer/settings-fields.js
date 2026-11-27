// What the settings window shows: every user-facing setting, grouped, with a label,
// help text and the kind of control. Pure, so a unit test can check it covers the whole
// config schema.
import { CONFIG_SCHEMA } from '../core/config.js';

export const SECTIONS = Object.freeze([
  { id: 'pet', title: 'Your pet', fields: ['pet', 'shuffleDaily', 'petSize', 'walkSpeed'] },
  {
    id: 'claude',
    title: 'Claude Code',
    fields: ['watchedFolders', 'reactToAllSessions', 'workingStaleMinutes', 'alertTimeoutMinutes', 'hookPort'],
  },
  { id: 'you', title: 'You', fields: ['idleMinutes', 'breakReminderMinutes', 'breakMinutes', 'bedtime', 'wakeTime'] },
  { id: 'apps', title: 'Apps', fields: ['quietDuringMeetings', 'hideWhenFullscreen', 'appRules'] },
  { id: 'system', title: 'System', fields: ['toggleShortcut', 'launchAtLogin', 'disableHardwareAcceleration'] },
].map((s) => Object.freeze({ ...s, fields: Object.freeze(s.fields) })));

/**
 * control: pets | checkbox | number | range | time | folders | rules | shortcut
 */
export const FIELDS = Object.freeze({
  pet: { label: 'Pet', control: 'pets', help: 'Who lives on your taskbar.' },
  shuffleDaily: { label: 'A different pet every day', control: 'checkbox', help: 'Picks a new pet each morning.' },
  petSize: { label: 'Size', control: 'range', step: 0.05, unit: 'x', help: 'How big the pet is.' },
  walkSpeed: { label: 'Walking speed', control: 'range', step: 0.05, unit: 'x', help: 'How fast it strolls about.' },

  watchedFolders: {
    label: 'Watched folders',
    control: 'folders',
    help: 'Your repos. Edits here make the pet focused, commits make it celebrate, and only Claude sessions working in these folders count. With none, every Claude session counts.',
  },
  reactToAllSessions: { label: 'React to all Claude sessions', control: 'checkbox', help: 'Count Claude sessions in any folder, not just watched ones.' },
  workingStaleMinutes: { label: 'Stop sweating after a quiet spell of', control: 'number', unit: 'minutes', help: 'If a Claude session goes quiet (for example, you pressed Esc), the pet stops sweating after this long.' },
  alertTimeoutMinutes: { label: 'Give up waving after', control: 'number', unit: 'minutes', help: 'How long the pet keeps saying "Need you!" for an unanswered prompt.' },
  hookPort: { label: 'Hook port', control: 'number', help: 'The local port Claude Code\'s hooks talk to. Change it only if another program uses it, then reinstall the hooks.' },

  idleMinutes: { label: 'Fall asleep after', control: 'number', unit: 'minutes idle', help: 'No keyboard or mouse for this long and the pet curls up.' },
  breakReminderMinutes: { label: 'Stretch reminder every', control: 'number', unit: 'minutes (0 = off)', help: 'A nudge to take a break after this long without one.' },
  breakMinutes: { label: 'A break is at least', control: 'number', unit: 'minutes away', help: 'Being idle this long resets the stretch reminder.' },
  bedtime: { label: 'Bedtime', control: 'time', nullable: true, help: 'After this the pet wears its nightcap. Untick to turn it off.' },
  wakeTime: { label: 'Morning', control: 'time', help: 'When bedtime ends.' },

  quietDuringMeetings: { label: 'Quiet during meetings', control: 'checkbox', help: 'Fades the pet, keeps it still and hides its speech bubbles in Zoom, Teams, Meet and Webex.' },
  hideWhenFullscreen: { label: 'Hide when something is fullscreen', control: 'checkbox', help: 'Games, videos and presentations.' },
  appRules: {
    label: 'App rules',
    control: 'rules',
    help: 'Match the app in front by process name, window title or install path (regular expressions, any case). The first matching rule wins.',
  },

  toggleShortcut: {
    label: 'Hide or show the pet',
    control: 'shortcut',
    nullable: true,
    help: 'A keyboard shortcut that works in any app. Click the box and press the keys you want; it needs Ctrl, Alt or the Windows key.',
  },
  launchAtLogin: { label: 'Start when I sign in', control: 'checkbox', help: '' },
  disableHardwareAcceleration: {
    label: 'Turn off hardware acceleration',
    control: 'checkbox',
    help: 'Try this if you see a black or white box behind the pet. Takes effect after restarting the pet.',
  },
});

/** Settings the app manages itself and never shows. */
export const HIDDEN_FIELDS = Object.freeze(Object.keys(CONFIG_SCHEMA).filter((key) => CONFIG_SCHEMA[key].internal));
