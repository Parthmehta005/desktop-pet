# Desktop Pet

A little animated pet that lives along the bottom of your Windows desktop and reacts to
your coding. It sweats while Claude Code works, cheers when Claude finishes, waves when
Claude needs you, and falls asleep when you step away.

> **Status: in development.** This README is a skeleton. Each section gets filled in as
> the milestones that build it are finished, and the whole thing is completed in M9.
> See [ROADMAP.md](ROADMAP.md) for the plan and progress, and [REVIEW.md](REVIEW.md) for
> how each milestone is tested.

---

## Features

- **A pet on your desktop.** A transparent, frameless, always-on-top strip just above the
  taskbar. The pet walks around, and clicks pass through everywhere except the pet itself.
- **Reacts to Claude Code.** It sweats while Claude works (more with several sessions),
  is happy when Claude finishes, waves when Claude is waiting for permission or an
  answer, and holds a "done" flag if Claude finished while you were away.
- **Reacts to you.** It types along when you edit files in a watched repo, throws
  confetti when you commit, sleeps when you're idle, and greets you when you're back.
- **Reacts to your apps.** Headphones for music, a controller for games, popcorn for
  videos, and it goes quiet during meetings.
- **Looks out for you.** A nightcap after bedtime, and a stretch reminder after a long
  stretch without a break.
- **Six pets to choose from**, with an optional daily shuffle.
- **A browser preview** that shows every pet in every animation, with no Windows needed.

## Pets

| Pet | Name |
|---|---|
| Cat | Mochi |
| Corgi | Biscuit |
| Penguin | Pip |
| Axolotl | Axo |
| Robot | Bolt |
| Soft care-bot | Nimbus |

_Screenshots are added in M3._

## Animation states

_The full table of states, what triggers each one, and what it looks like is added in
M9. Until then, see [ROADMAP.md → Animation states](ROADMAP.md#animation-states-18)._

---

## Requirements

_Added in M9: Windows 10 or 11, Node.js 22+, Git, and Claude Code (native or in WSL)._

## Windows setup

_Added in M9: step-by-step instructions to clone, install, run, and start at login._

## Connecting Claude Code

_Added in M6: installing the hooks from the tray or with `npm run hooks:install`, what
they change in `%USERPROFILE%\.claude\settings.json`, how to check they work, and how to
remove them._

## Choosing watched folders

_Added in M8: adding and removing repo folders, and what "react to all Claude sessions"
does._

## Configuration reference

_Added in M8: every setting in `config.json`, with its default._

## App rules

_Added in M8: matching apps by process name or window title to a mood, with examples._

## Using Claude Code in WSL

_Added in M6: networking setup so hooks inside WSL can reach the pet on Windows._

## Building an installer

_Added in M9: `npm run dist:win` and what it produces._

## Browser preview

You can see and play with every pet without Windows or Electron. The preview runs the
same renderer code and mood engine as the desktop app.

```sh
npm install
npm run preview
```

Then open <http://127.0.0.1:4173/preview/>. The preview server only serves the
`preview/` and `src/` folders, and only to your own machine.

There are two pages:

- **Gallery** (`/preview/`): every pet in all 18 animation states, each labelled with
  what triggers it.
  - Use the **Pet** menu to pick one pet. A single pet also shows its three sweat levels
    (one, two, or three or more busy Claude sessions).
  - **Dark background** checks how the pets look on a dark desktop.
- **Stage** (`/preview/stage.html`): the real pet walking along a pretend desktop. It has:
  - **Event buttons** for everything the app reacts to: Claude Code sessions (start
    working, a second session, permission prompts, tool finished, finished), you (go idle,
    come back, lock, unlock), coding (file edits, commits), and apps (Spotify, a Zoom
    meeting, a Steam game, YouTube, a fullscreen game).
  - **Click, drag and drop:** click the pet to pet it. Drag it to carry it around, and let
    go to drop it.
  - **Time speed:** up to an hour per second, so you can see it fall asleep, nudge you to
    stretch, or (with the **Night** clock) put on its nightcap.
  - **A status panel** showing the current mood, animation, modifiers, Claude sessions and
    the clock.

The stage also accepts URL options, for example
`stage.html?pet=softbot&speed=60&wallpaper=dark&time=00:45`.

## Development and tests

_Added in M5: the project layout, `npm test`, `npm run test:browser`,
`npm run test:electron`, and CI._

## Troubleshooting

_Added in M9: no transparency (GPU), SmartScreen, hooks not firing, the pet behind the
taskbar, and the foreground-app monitor._

## Uninstalling

_Added in M9: removing the hooks first, then the app and its data folder._
