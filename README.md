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

The pet learns what Claude Code is doing through Claude Code **hooks**: small commands
that Claude Code runs at moments like "a prompt was sent" or "Claude finished". Each hook
is one line of `curl` that passes Claude's event on to the pet. The pet listens on
`127.0.0.1`, so nothing leaves your computer.

### Install the hooks

From the tray icon choose **Install Claude Code hooks**, or run:

```sh
npm run hooks:install
```

This adds the pet's hooks to Claude Code's user settings,
`%USERPROFILE%\.claude\settings.json` (or `$CLAUDE_CONFIG_DIR\settings.json` if you set
that). Before changing the file, it:

- saves a backup next to it (`settings.json.desktop-pet-backup-<date>`)
- keeps all your other settings and hooks exactly as they were
- leaves the file alone if it isn't valid JSON, and tells you why

Running it again changes nothing. Afterwards, **start a new Claude Code session** (or
restart the open ones) so it picks up the hooks.

### Check they work

The tray menu should say **Claude Code: connected**, or run:

```sh
npm run hooks:status
```

Then ask Claude to do something in a watched folder. The pet starts typing and sweating,
waves when Claude needs your permission, and celebrates when Claude finishes.

| Claude Code hook | The pet |
|---|---|
| `UserPromptSubmit`, `PreToolUse`, `PostToolUse` | Works on its laptop and sweats. More sweat with more sessions at once |
| `Notification` (a permission prompt or a question) | Waves with a "Need you!" bubble |
| `Stop` | Hops with joy, "Done!". If you're away, it waits with a little flag |
| `SessionStart`, `SessionEnd` | Starts or forgets tracking that session |

A session that goes quiet for 10 minutes (for example, interrupted with Esc) stops
counting as busy. An unanswered "Need you!" gives up after 30 minutes.

### Which sessions count

- **No watched folders set:** every Claude Code session.
- **Watched folders set:** only sessions working inside them, unless you turn on
  "react to all Claude sessions".

### Privacy

Each hook hands the pet the JSON that Claude Code gives it. That can include your
prompt or a tool's input. The pet reads only:

- the event name
- the session ID
- the folder
- the notification type and text

It discards the rest and stores nothing. The hook posts only to `127.0.0.1`, uses a
private token, and is set to bypass any proxy.

### If something's off

- **The tray says the pet can't listen:** another program is using port 47321. Change
  `hookPort` in the pet's settings, then install the hooks again so they use the new
  port.
- **Status says "out of date":** the port or token changed since you installed. Run
  `npm run hooks:install` again.
- **The pet isn't running:** the hooks give up in under two seconds, print nothing, and
  never get in Claude's way.

### Remove the hooks

From the tray choose **Remove Claude Code hooks**, or run `npm run hooks:uninstall`. Only
the pet's own entries are removed, and a backup is saved first.

## Choosing watched folders

_Added in M8: adding and removing repo folders, and what "react to all Claude sessions"
does._

## Configuration reference

_Added in M8: every setting in `config.json`, with its default._

## App rules

_Added in M8: matching apps by process name or window title to a mood, with examples._

## Using Claude Code in WSL

If you run Claude Code inside WSL, its hooks need to reach the pet running on Windows.

1. **Turn on mirrored networking** so `127.0.0.1` inside WSL means your Windows machine.
   This needs Windows 11 22H2 or later. The pet only listens on `127.0.0.1`, so WSL's
   default NAT networking can't reach it. Add this to `%USERPROFILE%\.wslconfig`:

   ```ini
   [wsl2]
   networkingMode=mirrored
   ```

   Then run `wsl --shutdown` and open WSL again.
2. **Make sure curl is installed inside WSL:** `sudo apt install curl`.
3. **Install the hooks into WSL's Claude Code settings.** Run this from the pet's folder
   on Windows, with your distro and user name:

   ```sh
   npm run hooks:install -- --wsl --settings "\\wsl.localhost\Ubuntu\home\<you>\.claude\settings.json"
   ```

   `--wsl` writes hooks that use Linux's `curl`.

Watched folders work across the boundary: a WSL session in `/mnt/c/Users/you/code/app`
counts as `C:\Users\you\code\app`. A folder inside the WSL filesystem can be added as
`\\wsl.localhost\Ubuntu\home\you\code\app`. To check or remove the WSL hooks, use
`hooks:status` or `hooks:uninstall` with the same `--settings` (and `--wsl` for status).

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

### Project layout

```
src/core/       Pure logic shared by everything (no Node, Electron or DOM imports):
                the mood engine, moods, walker, path matching, app rules, config schema
src/renderer/   What you see: the pet rig, the six pets, props, animations, the
                controller that walks the pet, and the desktop window's page
src/main/       Electron main process: lifecycle, the pet window, the app:// protocol
                and security, config storage, the tray, and the event bus
preview/        Browser preview pages (gallery and stage)
assets/         Icons (SVG sources and rendered PNGs)
scripts/        Preview server, icon builder, Electron test runner
test/unit/      node:test unit tests
test/browser/   Playwright tests against the preview pages
test/electron/  Playwright tests that launch the real app
```

### Commands

| Command | What it does |
|---|---|
| `npm start` | Runs the desktop app |
| `npm run preview` | Serves the browser preview at http://127.0.0.1:4173/preview/ |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run test:browser` | Browser tests (starts the preview server itself) |
| `npm run test:electron` | Electron tests. On Linux without a display they run inside `xvfb-run` |
| `npm run test:all` | All of the above |
| `npm run build:icons` | Re-renders the PNG icons from `assets/*.svg` |

The tests never touch your real settings. Each Electron test launches the app with its
own temporary settings folder, through the `DESKTOP_PET_USER_DATA` environment variable.

On Linux, the browser tests need Playwright's Chromium (`npx playwright install
chromium`), and the Electron tests need `xvfb` (`apt-get install xvfb`).

### CI

GitHub Actions runs on every push:

- lint and unit tests on Ubuntu and Windows
- browser tests on Ubuntu
- Electron tests on Ubuntu, under xvfb

## Troubleshooting

_Added in M9: no transparency (GPU), SmartScreen, hooks not firing, the pet behind the
taskbar, and the foreground-app monitor._

## Uninstalling

_Added in M9: removing the hooks first, then the app and its data folder._
