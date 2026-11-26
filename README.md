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

_Added in M4: `npm run preview`, the gallery, and the interactive stage._

## Development and tests

_Added in M5: the project layout, `npm test`, `npm run test:browser`,
`npm run test:electron`, and CI._

## Troubleshooting

_Added in M9: no transparency (GPU), SmartScreen, hooks not firing, the pet behind the
taskbar, and the foreground-app monitor._

## Uninstalling

_Added in M9: removing the hooks first, then the app and its data folder._
