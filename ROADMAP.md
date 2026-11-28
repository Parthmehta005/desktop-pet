# Roadmap

A Windows desktop pet built with Electron. It's a transparent, frameless, always-on-top
strip along the bottom of the screen, where an animated pet walks around and reacts to
what you and Claude Code are doing.

This file is the build plan: what each milestone delivers, where its boundary is, and how
we know it's done. [REVIEW.md](REVIEW.md) holds the test checklist that every milestone
must pass, and the review log. [README.md](README.md) describes the finished app and is
completed in the last milestone.

---

## Status

| # | Milestone | Status |
|---|---|---|
| M0 | Planning docs | Done |
| M1 | Project scaffold and core logic | Done |
| M2 | Pet rig, first pet, every animation | Done |
| M3 | The other five pets | Done |
| M4 | Interactive browser preview | Done |
| M5 | Electron shell | Done |
| M6 | Claude Code integration | Done |
| M7 | Local activity sources | Done |
| M8 | Settings window and polish | Done |
| M9 | Packaging, Windows CI, final README | Done |
| M10 | Quick hide and show | Done |
| M11 | A short GUIDE.md | Done |
| M12 | Low-battery panic | Done |
| M13 | Releases and versions (v1.0.0) | Done |

Status values: `Not started` · `In progress` · `In review` · `Done`.

### Changes after M13

After M13 you asked to stop numbering work as milestones. Each change is still planned
with you first, built in small commits (with Conventional Commits prefixes such as
`ci:`, `fix:` or `docs:`), checked with REVIEW.md §1 and logged in the review log.

| Change | Asked for | Status |
|---|---|---|
| CI runs only the checks a commit needs, with no risk (see below) | 2026-11-28 | Done |
| A new pet lineup: Mochi, Pip, Maple, Hum and Mango (see below) | 2026-11-28 | Done |
| Drag the pet higher, and a pet opacity setting (see below) | 2026-11-28 | In progress |

**CI runs only the checks a commit needs.** Every code change still gets every test on
Linux and Windows; time is saved only where nothing can break:
- The Windows job is split in two that run at the same time: the app tests, and the
  installer build with its tests. Same tests, about 4 minutes instead of 6.
- A first job compares the commit with the nearest commit in its history that passed CI.
  Exactly the same files: nothing more runs (a fast-forward merge to `main`). Only docs
  changed (root `.md` files, `docs/`): lint and unit tests on both systems, which are the
  only tests that read docs, and a test keeps it that way. Anything else, no such commit,
  a run started by hand, or any doubt: everything runs.
- Planned commits: `docs:` these conventions; `ci:` the planner script with its tests;
  `ci:` split the Windows job; `ci:` wire the planner into the workflow; `docs:` the
  README's CI section; then check all three cases on GitHub and log the review.

**A new pet lineup.** You found the six pets too alike, and picked from eleven new
concepts. The lineup becomes five: Mochi and Pip stay, and three new ones join.
- **Maple** (`bluepanda`, "Blue panda"): sky blue, with a big bubbly ringed tail, a white
  face mask and deep blue socks.
- **Hum** (`bee`, "Bumblebee"): round and fuzzy with stripes, antennae and buzzing wings.
- **Mango** (`bat`, "Fruit bat"): a light green head, a dark green body, and purple
  wings, feet and inner ears.
- Biscuit, Axo, Bolt and Nimbus are removed. Nobody uses the app yet, so there's no
  migration: a saved pet that no longer exists falls back to Mochi, as any unknown pet
  already does, and a test covers it.
- Built on a side branch, `feat/new-pets`, merged through a pull request once CI is
  green, as you asked.
- Planned commits: `docs:` this plan; `feat:` the new lineup (drawings, signature
  moves, the pet list, the settings grid, tests, CHANGELOG and CLAUDE.md); `docs:` the
  README and its pets picture; then the review.

**Drag the pet higher, and a pet opacity setting.**
- You could only lift the pet about 110 px above the taskbar. It lives in a window only
  as tall as the pet plus room for bubbles, and dragging was capped at that window's
  top. Now, while you carry it, the window grows to the full height of the work area
  (the screen above the taskbar), so you can lift it anywhere; let go and it falls back
  to the taskbar as before, and the window shrinks back once it lands. The window stays
  small the rest of the time, so a full-screen always-on-top window never sits there
  for no reason. If the pet's page reloads while it's carried, the window shrinks back.
- A new **Opacity** slider under Your pet, beside Size and Walking speed: from 20% to
  100% (the default). It never goes lower, so the pet can't vanish by accident; hiding
  it is what Ctrl+Alt+P is for. It stacks with the fade in meetings.
- Built on a side branch and merged through a pull request once CI is green, as you
  asked. No release yet.
- Planned commits: `docs:` this plan; `fix:` drag the pet higher; `feat:` the opacity
  setting; `docs:` the README (also its settings reference, which still listed the
  removed pets); then the review.

---

## What we're building

### Pets (5)

| ID | Name | Look | Signature touch |
|---|---|---|---|
| `cat` | Mochi | Round cream cat | Tail swish, ear twitch |
| `penguin` | Pip | Small penguin | Waddle walk, flipper flaps |
| `bluepanda` | Maple | Sky-blue panda with a bubbly ringed tail and a white face mask | Tail swish with a flick |
| `bee` | Hum | Round striped bumblebee with antennae and glassy wings | Wings buzz; bobs as it flies along |
| `bat` | Mango | Green fruit bat with big ears, purple wings and a little fang | Wings flutter; wraps them round itself to sleep |

Until the lineup change after M13 there were six: `corgi` Biscuit, `axolotl` Axo, `robot`
Bolt and `softbot` Nimbus have gone, and Maple, Hum and Mango have joined.

All pets are original designs. They're drawn as SVG built from the same set of named
parts (body, head, eyes, mouth, legs, tail and so on), so every animation works for every pet.
The pet can be picked from the tray or settings, with an optional "shuffle daily".

### Animation states (19)

Each state has a stable ID that the code, tests and preview page all use.

| ID | Trigger | What the pet does |
|---|---|---|
| `wander` | Default, when nothing else applies | Walks, pauses, sits, looks around, blinks |
| `working` | A Claude Code session in a watched folder is running | Hunches over a tiny laptop typing frantically and sweats. More sweat with 2+ sessions, steam with 3+ |
| `happy` | A Claude session finished | Jumps with sparkles and a "Done!" bubble (about 8s) |
| `alert` | Claude is waiting for a permission or an answer | Waves with a "!" bubble until you respond |
| `away-done` | Claude finished while you were idle | Waits holding a little "done" flag, then plays `happy` when you return |
| `sleeping` | Idle for `idleMinutes` (default 5) or the screen is locked | Curls up with Zzz and slow breathing |
| `greeting` | App start, unlock, or coming back from idle | Waves with a "Hi!" bubble (about 3s) |
| `focused` | Files edited in a watched repo in the last 2 minutes, with no Claude running | Types calmly on the laptop, no sweat |
| `celebrating` | A new commit in a watched repo | Confetti burst (about 4s) |
| `vibing` | A music app is in the foreground | Headphones and head-bob |
| `gaming` | A game is in the foreground | Holds a controller, button-mashing |
| `watching` | A video site or app is in the foreground | Eats popcorn |
| `meeting` | A meeting app is in the foreground | Modifier: stays still at 50% opacity with no bubbles |
| `bedtime` | Still active after `bedtime` (default 00:30) | Nightcap, yawns, and an occasional "Bed?" bubble |
| `stretch` | 90 minutes of activity with no 5-minute break | Stretches with a "Break?" bubble |
| `petted` | You click the pet | Hearts (about 2s) |
| `held` | You drag the pet | Dangles with its legs kicking |
| `falling` | You drop the pet | Falls to the taskbar and squashes on landing |
| `low-battery` | On battery, at or below `lowBatteryPercent` (default 10%) | Runs to the bottom-right, points at the battery icon, shakes and sweats with a "Low battery!" bubble; a click opens Windows' battery settings (added in M12) |

There's one more modifier, `hidden`: if enabled, the pet hides while an app is fullscreen.

**Priority** when several states apply:
1. `held` / `falling` (you're physically moving it)
2. `low-battery` (and it ignores the meeting and fullscreen modifiers)
3. `petted`
4. `alert`
5. `celebrating` / `happy`
6. `working`
7. `away-done`
8. `sleeping`
9. `greeting`
10. `vibing` / `gaming` / `watching`
11. `stretch` / `bedtime` (stretch is brief, so it can still show up at night)
12. `focused`
13. `wander`

The modifiers (`meeting`, `hidden`) apply on top of whichever state wins.

### Signal sources

| Source | How | Feeds |
|---|---|---|
| Claude Code hooks | A one-line `curl` hook sends each event to `127.0.0.1:<port>` with a token. 2s timeout, never blocks Claude | `working`, `happy`, `alert`, `away-done` |
| Repo watcher | `chokidar` on the configured folders. Ignores `node_modules`, build output and `.git` internals. Reads `.git/logs/HEAD` to spot commits | `focused`, `celebrating` |
| Idle monitor | Electron `powerMonitor` idle time plus lock and unlock events | `sleeping`, `away-done`, `greeting`, `stretch` |
| Foreground app | A background PowerShell process that reports the active window's process name and title (Windows only; does nothing on other platforms) | `vibing`, `gaming`, `watching`, `meeting`, `hidden` |

Claude hook events map like this:
- `UserPromptSubmit` → working
- `PostToolUse` → still working (also clears `alert`)
- `Notification` (permission or question) → alert
- `Stop` → happy, or `away-done` if you're idle
- `SessionEnd` → clears that session

A session that sends nothing for `workingStaleMinutes` (default 10) stops counting as
working. Only sessions whose `cwd` is inside a watched folder count, unless "react to all
Claude sessions" is on. Path matching understands Windows paths (`C:\`, `c:/`, any letter
case) and WSL paths (`/mnt/c/...`).

### Tech choices

| Area | Choice |
|---|---|
| App runtime | Electron 45, plain ES modules, no bundler or build step |
| Runtime dependency | `chokidar` |
| Unit tests | Node's built-in `node:test` |
| Browser and Electron tests | Playwright (Chromium for the preview page; Playwright's `_electron` under `xvfb-run` for the app) |
| Lint | ESLint (flat config) |
| Packaging | `electron-builder` (26.18.1, dev only): Windows NSIS installer and a portable `.exe` |
| CI | GitHub Actions on `ubuntu-latest` and `windows-latest` |

---

## Working agreement

- **Milestones run in order.** Each one ends with the [REVIEW.md](REVIEW.md) gate: the
  universal checks plus that milestone's own section. The result goes in the review log.
  (After M13, work is no longer numbered: see [Changes after M13](#changes-after-m13).)
- **Incremental commits.** Each commit is one logical step and leaves lint and tests
  passing, so any commit can be checked out and tested on its own. Commit messages
  started with the milestone, for example `M3: add Pip the penguin`; after M13 they use
  Conventional Commits, for example `ci: split the Windows job`.
- **Branch:** all work goes on `ccr-f206000e-0v0714` and is pushed when each milestone
  finishes. No pull request unless asked.
- **Moving on:** when a milestone passes its gate, I record it, push, and start the next
  one. I stop and ask if a gate fails for a reason I can't fix, or if a decision comes up
  that's yours to make.
- **Scope creep** goes to the [backlog](#backlog-not-committed), not into the current
  milestone.

### Dependencies

```
M0 ─ M1 ─ M2 ─ M3 ─ M4 ─ M5 ─┬─ M6 ─┬─ M8 ─ M9 ─ M10 ─ M11 ─ M12 ─ M13
                             └─ M7 ─┘
```

M6 and M7 both build on M5 and don't depend on each other. M10 to M13 came after M9,
at your request.

---

## Milestones

### M0 — Planning docs

**Goal:** agree on the plan before writing any code.

- **Scope:** this file, `REVIEW.md`, `CLAUDE.md` (working notes and decisions for
  Claude), and a `README.md` skeleton.
- **Boundary:** no code, no `package.json`.
- **Done when:** all four files are committed and pushed, and you've approved them.

---

### M1 — Project scaffold and core logic

**Goal:** all the decision-making exists as pure, fully tested JavaScript. Given a
sequence of events and a clock, the engine says which state the pet is in and how it
should move.

**Scope**
- `package.json` with scripts `lint`, `test` and `test:all`. Also `.gitignore`,
  `.editorconfig` and the ESLint config.
- CI workflow: lint and unit tests on Linux and Windows.
- `src/core/moods.js`: the 18 states and 2 modifiers, with priority, duration, bubble
  text and movement profile.
- `src/core/paths.js`: path normalisation and "is inside a watched folder" for Windows,
  WSL and POSIX paths.
- `src/core/engine.js`: a reducer `(state, event, now) → state` and `selectMood(state, now)`.
  It covers Claude sessions (several at once, stale timeout), idle and away, repo
  activity, app moods and modifiers, nudges, and interaction.
- `src/core/app-rules.js`: matches the foreground process name or window title to a mood.
- `src/core/walker.js`: position, direction, pauses and speed for each mood, kept within
  the screen bounds.
- `src/core/config.js`: config defaults, validation and version migration. This is pure
  logic with no file access.
- Small helpers added along the way: `src/core/pets.js` (the six pet IDs and names),
  `src/core/time.js` (time-of-day windows) and `src/core/random.js` (a seeded random
  generator, so walking can be replayed in tests).

**Boundary:** no DOM, no Electron, no network, and no file access outside tests. No art.

**Planned commits**
1. Scaffold: package.json, ESLint, test runner, folder layout
2. CI workflow (Linux and Windows: lint and unit tests)
3. Mood catalogue
4. Path matching and tests
5. Engine: Claude sessions (working, happy, alert, stale) and tests
6. Engine: idle, away, greeting, sleeping and tests
7. Engine: repo activity (focused, celebrating) and tests
8. App rules, app moods and the meeting/hidden modifiers, with tests
9. Engine: nudges (bedtime, stretch) and interaction (petted, held, falling), with tests
10. Walker and tests
11. Config schema and tests
12. Review: update the status table and review log

**Done when:** every state can be reached through events in a unit test, the priority
order is tested pairwise, CI is green on Linux and Windows, and REVIEW.md §M1 passes.

---

### M2 — Pet rig, first pet, every animation

**Goal:** Mochi the cat performs all 18 states in a browser, and the rig is general
enough that the other pets only need new shapes.

**Scope**
- `src/renderer/rig.js`: the pet definition format, an SVG builder, standard part names,
  and the base CSS.
- `src/renderer/props.js`: sweat (3 intensity levels), steam, Zzz, hearts, sparkles,
  confetti, a speech bubble, a "!" mark, laptop, headphones, controller, popcorn,
  nightcap and a done flag.
- `src/renderer/animations.css`: keyframes for every state.
- `src/renderer/pets/cat.js`, plus `pets/pets.css` for each pet's signature touches.
- `src/renderer/pet-view.js` and `pet.css`: the element that shows one pet in one
  state, with its speech bubble.
- `scripts/preview-server.js` (no dependencies; `npm run preview`) and a gallery page
  `preview/index.html` that shows one live cell per state.
- Playwright config and browser tests (`npm run test:browser`).

**Boundary:** no engine wiring and no walking across the page. Each gallery cell shows
one state on a loop. Only one pet.

**Planned commits**
1. Preview server, empty gallery page, Playwright config and a smoke test
2. Rig: definition format, SVG builder, base CSS
3. Mochi: base drawing, idle blink and walk cycle
4. Props layer
5. Claude states: working (3 intensities), happy, alert, away-done
6. Rest and time states: sleeping, greeting, bedtime, stretch
7. Coding and app states: focused, celebrating, vibing, gaming, watching, meeting
8. Interaction states: petted, held, falling and landing
9. Gallery covering every state, browser tests, and saved screenshots
10. Review

**Done when:** the gallery shows Mochi in all 18 states with no console errors, I've
looked at the screenshot of each state, and REVIEW.md §M2 passes.

---

### M3 — The other five pets

**Goal:** six pets, all with every state.

**Scope:** `src/renderer/pets/` gains `corgi.js`, `penguin.js`, `axolotl.js`, `robot.js`
and `softbot.js`, each with its signature touch. The gallery becomes a pets × states
grid with a pet filter.

**Boundary:** pet definitions and their own small animation tweaks only. No changes to
the engine. Changes to the rig only if a pet needs a new part, and then backward
compatible.

**Planned commits**
1. Gallery grid and pet filter
2. Biscuit the corgi
3. Pip the penguin
4. Axo the axolotl
5. Bolt the robot
6. Nimbus the soft care-bot
7. Browser tests for every pet and state, plus screenshots
8. Review

**Done when:** all 108 combinations render with no errors, every pet keeps the same
footprint and baseline (so walking and landing line up), and REVIEW.md §M3 passes.

---

### M4 — Interactive browser preview

**Goal:** the whole pet experience runs in a browser, driven by the real engine. This is
the same renderer code the Electron window will load.

**Scope**
- `src/renderer/controller.js`: an animation loop connecting engine → walker → the pet
  element, plus bubble timing, the quiet (meeting) and hidden modifiers, and sweat
  intensity from the number of sessions.
- Pointer interaction: hit-testing on the pet, click to pet it, drag to hold it, drop to
  make it fall with gravity and squash on landing.
- A stage page (`preview/stage.html`, linked from the gallery): a simulated desktop strip; buttons for every event
  (Claude start, permission, stop, session end, idle, return, lock, commit, file edit,
  open Spotify, Zoom, Steam, YouTube, fullscreen); a pet picker; a light/dark wallpaper
  toggle; and a time-speed control so idle and nudge timers can be tested quickly.

**Boundary:** browser only. Events come from the stage buttons, not from real sources.

**Planned commits**
1. Controller loop: engine and walker drive the pet across the stage
2. Bubbles and modifiers
3. Pointer interaction (pet, drag, drop, fall)
4. Stage UI (event buttons, pet picker, wallpaper, time speed)
5. Browser tests for stage flows
6. Review

**Done when:** every state can be reached from the stage, the pet stays inside the strip
at every width, drag and drop works, and REVIEW.md §M4 passes.

---

### M5 — Electron shell

**Goal:** a real desktop app shows the pet in a transparent, frameless, always-on-top
strip that lets clicks through, using the M4 renderer unchanged.

**Scope**
- `src/main/main.js`: app lifecycle and a single-instance lock.
- `src/main/pet-window.js`: a strip window on the work area just above the taskbar.
  Transparent, frameless, always-on-top, hidden from the taskbar, and it follows
  display changes.
- `src/main/preload.js`: an IPC bridge via `contextBridge`. The window runs with
  `contextIsolation` and `sandbox` on, `nodeIntegration` off, and a content security
  policy.
- Click-through: mouse events pass through the window except when the cursor is over
  the pet.
- `src/main/config-store.js`: `config.json` in `userData`, written atomically, with
  recovery from a corrupt file.
- `src/main/tray.js`: pet picker, pause reactions, a "test reactions" submenu that fires
  every event by hand, and quit. Includes a tray icon asset.
- Electron smoke tests (`npm run test:electron`, under `xvfb-run` on Linux).

**Boundary:** no real signal sources yet. Events come only from the tray's
"test reactions" menu and the test hooks. No settings window.

**Planned commits**
1. Electron dependency, main entry, lifecycle, single-instance lock
2. Pet window (transparent strip on the work area, display changes)
3. Preload bridge, security settings, content security policy; the renderer runs in
   Electron
4. Click-through toggling
5. Config store
6. Tray menu and icon
7. Electron smoke tests
8. Review

**Done when:** the app launches under xvfb with the window properties checked, the pet
renders and walks, a test reaction changes the state, and REVIEW.md §M5 passes.

---

### M6 — Claude Code integration

**Goal:** real Claude Code sessions make the pet sweat, celebrate and wave, and the
hooks can be installed and removed safely.

**Scope**
- `src/main/sources/hook-server.js`: listens on `127.0.0.1` only. Requires the token
  header, limits body size, and replies `204` with an empty body so nothing gets injected
  into Claude's context.
- `src/main/sources/claude-events.js`: turns a hook payload into an engine event, and
  filters by `cwd` against the watched folders.
- `src/main/hooks-installer.js`: merges the hook entries into `~/.claude/settings.json`.
  Backs the file up first, keeps your other hooks, is safe to run twice, removes only its
  own entries, and refuses to touch malformed JSON.
- `scripts/hooks.js`: `npm run hooks:install`, `hooks:uninstall` and `hooks:status`.
- Tray entries to install or remove the hooks, and a hook status line.

**Boundary:** Claude events only. No file watching, idle or foreground-app detection yet.

**Planned commits**
1. Hook server and tests
2. Payload → engine event mapping and the `cwd` filter, with tests
3. Wire the server into the main process; generate and store the token
4. Hooks installer and tests
5. Command-line hooks scripts
6. Tray entries for the hooks
7. End-to-end test: install into a temporary HOME, run the exact installed command
   through a real shell with sample payloads, and check the Electron pet reacts
8. Review

**Done when:** the installed command, run exactly as Claude Code would run it, moves the
pet through working → alert → working → happy; uninstall leaves the settings file
equivalent to the original; and REVIEW.md §M6 passes.

---

### M7 — Local activity sources

**Goal:** your own activity (file edits, commits, idle time, the foreground app) drives
the pet.

**Scope**
- `src/main/sources/repo-watcher.js`: `chokidar` with ignore rules, a debounced activity
  event, and commit detection via `.git/logs/HEAD` (worktrees included).
- `src/main/sources/idle-monitor.js`: polls `powerMonitor` idle time, handles lock and
  unlock, with an injectable clock for tests.
- `src/main/sources/app-monitor.js` and `scripts/foreground.ps1`: a long-running
  PowerShell child process that prints JSON lines with the process name, window title
  and whether it's fullscreen. Restarts if it crashes; does nothing on non-Windows.
- Wiring: all sources feed the engine through one event bus.

**Boundary:** no settings UI. Rules and folders come from `config.json` and the defaults.

**Planned commits**
1. Repo watcher (file activity) and tests using temporary folders
2. Commit detection and tests using real temporary git repos
3. Idle monitor and tests
4. Foreground app monitor: PowerShell script, Node wrapper, and parser tests with
   recorded output
5. Wire everything into the main process; end-to-end test in Electron (edit a file →
   focused, commit → celebrating, simulated idle → sleeping)
6. Review
7. Fixes for bugs CI found after the review had started (they landed between M8 commits):
   settings saved before reporting success, Windows path comparison in commit detection,
   and commits made straight after another

**Done when:** each source has its own tests, the Electron end-to-end flows pass, the
watcher ignores `node_modules`, and REVIEW.md §M7 passes. The PowerShell script itself
is checked on Windows CI in M9.

---

### M8 — Settings window and polish

**Goal:** everything can be configured from a UI, and changes take effect without
restarting the app.

**Scope:** a settings window opened from the tray, covering:
- watched folders (add with a folder picker, remove) and "react to all Claude sessions"
- a pet picker with live previews, and shuffle daily
- idle minutes, pet size, walk speed, bedtime time and break-reminder interval
- quiet during meetings and hide when fullscreen
- an app rules editor
- Claude hooks status with install and remove
- launch at login

Changes apply live: watchers restart and the pet swaps on the spot.

**Boundary:** no packaging. No new states or sources.

**Planned commits** (revised while building: the form is generated from one field list,
so the window and the simple controls came together)
1. Let test runs share a machine (preview port, free hook ports)
2. Settings window, IPC (get and set config, with validation) and the simple controls
   (checkboxes, numbers, sliders, times)
3. Watched folders UI
4. Pet picker with live previews, and shuffle daily
5. App rules editor
6. Hooks panel and launch at login
7. Apply config changes live, and Electron end-to-end tests for the settings window
8. README sections and review
9. Fixes from CI and the review: quick list edits losing one, and the pet card layout

**Done when:** every config field can be edited and is validated, changes apply
immediately, the settings survive a restart, and REVIEW.md §M8 passes.

---

### M9 — Packaging, Windows CI, final README

**Goal:** something you can install on Windows, with real Windows checks in CI and
complete docs.

**Scope**
- `electron-builder` config: NSIS installer and portable `.exe`, plus an app icon.
- Windows CI job extended: Electron smoke test on `windows-latest`, a PowerShell
  foreground-monitor smoke test, building the installer, and uploading it as an
  artifact.
- The final README: features, screenshots, Windows setup, connecting Claude Code, watched
  folders, config reference, app rules, WSL, building the installer, the browser preview,
  development and tests, troubleshooting, and uninstalling.
- A full code review of the whole app, and fixes for what it finds.

**Boundary:** no new features.

**Planned commits**
1. electron-builder config and app icon (plus a test suite for the built app, which
   also checks the foreground monitor on Windows)
2. Windows CI: the whole Electron suite, the installer and portable build, the built-app
   tests, and the installer artifact
3. README
4. Fixes from the final review (two commits)
5. Final review log

**Done when:** CI is green on both operating systems, including the Windows-only checks;
the installer artifact builds; the README's setup steps have been followed from a clean
clone on Linux (except the Windows-only steps); and REVIEW.md §M9 passes.

---

### M10 — Quick hide and show

Asked for after M9: a fast way to put the pet away and bring it back.

**Goal:** one click in the tray, or one keyboard shortcut from anywhere, hides the pet,
and the same again brings it back.

**Scope**
- A tray item that reads **Hide pet** or **Show pet**.
- A global keyboard shortcut that toggles it, **Ctrl+Alt+P** by default. It can be
  changed in Settings by clicking the field and pressing the new keys, or cleared to turn
  it off. If another app already owns the shortcut, Settings says so.
- While hidden, the pet keeps following Claude, idle time and apps, so it comes back in
  the right mood.
- Starting the app again while the pet is hidden brings it back (and opens Settings, as
  before).
- After a restart the pet is always shown: a quick hide is temporary, and a pet that
  came back invisible would look like a broken app.

**Boundary:** no other new features. Only the shortcut is a new setting; "hidden" is not
saved.

**Planned commits**
1. Plan (this section and REVIEW §M10)
2. Shortcuts in `src/core`: checking one, writing it one standard way, and turning a
   key press into one
3. Hide and show: the main-process toggle, the tray item, and a second launch showing
   the pet
4. The `toggleShortcut` setting: the global shortcut registered at start and whenever
   it changes, failures reported, and its field in Settings (press keys to set, clear to
   turn off). One commit, because every setting must have a control in the window
5. README and review
6. Fix from Windows CI: Electron tests wait for the app to finish starting

**Done when:** the tray item and the shortcut hide and show the pet, the pet's mood
carries on while hidden, the shortcut can be changed and turned off from Settings with
clashes reported, every suite passes on both operating systems, and REVIEW.md §M10
passes.

---

### M11 — A short GUIDE.md

Asked for after M10: one short page that gets someone set up and using the pet without
reading the whole README.

**Goal:** a `GUIDE.md` that a new user can follow top to bottom without getting stuck.

**Scope**
- Setup in a few numbered steps: get the app, find the pet and its tray icon, connect
  Claude Code, and the optional settings worth changing.
- How to use it: a "to do this, do that" table, what the pet reacts to, the three most
  likely problems, and uninstalling.
- One path only. Anything less common (WSL, building from source) is a link to the
  README.
- A link to it at the top of the README.

**Boundary:** documentation only, plus a test that keeps it honest. No app changes.

**Planned commits**
1. Plan (this section and REVIEW §M11)
2. `GUIDE.md`, its test (at most 80 lines, and every button, menu item and setting it
   names exists in the app under exactly that name), and the README link
3. Review
4. Fix from CI on `main`: a reliable crash-recovery test

**Done when:** `GUIDE.md` is at most 80 lines, every step was checked against the app,
its test passes, and REVIEW.md §M11 passes.

---

### M12 — Low-battery panic

Asked for after M11: when the laptop is about to run out, the pet panics and shows you
where the battery is.

**Goal:** on battery power at or below a set level, the pet drops everything, runs to the
bottom-right corner (where Windows shows the battery icon), points at it in a panic, and
a click on it opens Windows' battery settings.

**Decisions (yours, from the questions before building)**
- It points at the battery icon, and clicking the pet then opens battery settings.
- It starts at **10%** by default; the level can be changed or the panic turned off.
- It beats everything, meetings included. (Being dragged or falling still come first,
  because those are you moving it.)

**Scope**
- A new animation state, `low-battery`, for all six pets: a panicked shake, sweat, a
  paw pointing down and to the right, a blinking low-battery icon and a "Low battery!"
  bubble that repeats.
- Engine: a `battery` event (`percent`, `charging`, `present`), the new mood above
  every other mood, and the meeting and fullscreen modifiers set aside while it lasts.
- Walking: the pet runs to the right-hand end of the strip and faces right.
- Settings: `lowBatteryPercent` (0 to 50, default 10, 0 = off).
- Windows: the foreground-app monitor's PowerShell also reports the battery
  (`GetSystemPowerStatus`), as a battery event from its own source. Battery events get
  through "Pause reactions", like the panic gets through meetings.
- If the pet is hidden (Ctrl+Alt+P) when the panic starts, it comes back once; hiding it
  again keeps it hidden until the panic ends.
- Clicking the pet while it panics opens `ms-settings:batterysaver` (Windows only; the
  main process allows only that address).
- The browser preview's stage gets "Low battery" and "Plug in" buttons.

**Boundary:** no other new features. A desktop PC without a battery never panics.

**Planned commits** (revised while building: a new mood needs its look, and a new setting
its control in the settings window, in the same commit, or the tests that check every
state has a look and every setting has a control fail)
1. Plan (this section, REVIEW §M12, the states table)
2. The `low-battery` mood: the battery event, its priority, the setting and its control,
   and its animation for all six pets
3. Controller and stage: running to the corner, pointing, the click, and the stage
   buttons
4. Windows battery source, opening battery settings, showing a hidden pet, and getting
   through pause
5. README, GUIDE and review
6. Fixes from Windows CI: settings saves retried while the file is briefly locked; the
   real monitor script tested on Windows, with its errors reported; time for the
   monitor's first start on a fresh machine

**Done when:** every pet has the new animation, the panic starts at the threshold only
on battery and stops when plugged in, it wins over every other mood and over meetings,
the click opens battery settings on Windows, every suite passes on both operating
systems, and REVIEW.md §M12 passes.

---

### M13 — Releases and versions (v1.0.0)

Asked for after M12: getting the app meant finding the newest green CI run and
downloading a zip that expires after 14 days. Make it one link, and give the app proper
version numbers.

**Goal:** a permanent link that always downloads the newest installer, and numbered
releases that follow Semantic Versioning, starting with **v1.0.0**.

**Decisions**
- **1.0.0, not 0.x.** In Semantic Versioning, 0.x means "early development, anything may
  change"; 1.0.0 is the first release meant for people to use. Every planned feature is
  built and tested, so this is 1.0.0. After that: MAJOR for changes that break existing
  settings or behaviour, MINOR for new features, PATCH for fixes.
- **GitHub Releases.** A release workflow on Windows, started from the Actions tab on
  `main` (or by pushing a tag like `v1.0.0`): it checks the version is new and has a
  CHANGELOG entry, runs the Windows tests, builds the installer and portable app, tests
  the built app, tags the commit, and publishes a release with the changelog as its
  notes.
- **Stable file names** on releases (`DesktopPet-Setup.exe`, `DesktopPet-Portable.exe`),
  so `releases/latest/download/DesktopPet-Setup.exe` always gets the newest installer.
  The version is in the release title, the installer and the app.
- The app shows its version in the tray menu and the settings window.
- `CHANGELOG.md` in the Keep a Changelog format.

**Boundary:** no auto-update inside the app (the pet stays off the network); no code
signing (still in the backlog).

**Planned commits**
1. Plan (this section and REVIEW §M13)
2. Version 1.0.0: `package.json`, `CHANGELOG.md`, the version in the tray and settings
   window, and the scripts that check a release tag and pull its notes from the
   changelog, with tests
3. The release workflow (then a fix: its tests run in the same shell as CI's Windows
   job)
4. README and GUIDE: the one-link download, versions and how to release
5. Review of everything but the release itself; merge
6. Release from the Actions tab: the workflow makes the tag itself (this session can't
   push tags, and it's one click for you)
7. Merge, run the release on `main`, check the v1.0.0 release, and finish the review

**Done when:** the v1.0.0 release exists with both files, the GUIDE's link downloads the
installer, every suite passes on both operating systems, and REVIEW.md §M13 passes.

---

## Backlog (not committed)

Ideas to pick up if time allows, or later:
- `confused` when a Claude tool call fails, and `dizzy` during context compaction
  (`PreCompact` hook)
- The pet roaming across multiple monitors
- Custom pet names, and loading user-made pets from a folder
- Optional sounds (off by default)
- Two pets at once that interact with each other
- From the M9 review:
  - Electron fuses (no `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`, no inspector) for
    release builds. They'd stop Playwright driving the built app, so they need a
    separate release configuration.
  - Code signing, so SmartScreen doesn't warn on first run.
  - Installing hooks into WSL's Claude Code from the settings window (today it needs the
    command-line tool from a copy of the repository).
  - Remembering which Claude sessions are busy across a reload of the pet's page (after
    a crash it forgets until each session's next hook).
  - `actions/upload-artifact@v4` runs on a deprecated Node version on CI; move to a newer
    major when one is available.
- From the M13 review:
  - An optional "a new version is out" notice. It would mean the pet going online, so
    it would be off by default.
  - A `winget` package, once releases are code-signed.

## Risks

| Risk | Mitigation |
|---|---|
| Transparency and click-through behave differently on some Windows GPUs | Keep the window code isolated; add a "disable hardware acceleration" option; the Windows CI smoke test in M9; README troubleshooting |
| Claude Code's hook format or execution on Windows changes | The installer marks its own entries and has a `status` check; payload parsing tolerates missing fields; README notes how to verify |
| Pushing workflow files may need extra permission on the git remote | If the push is refused, keep the workflow in the repo for you to enable, and rely on local Linux runs |
| `chokidar` is slow on huge repos | Ignore rules, a depth limit, and watching only the configured folders |
| Electron under `xvfb` isn't Windows | Electron tests check wiring and behaviour; Windows CI covers platform behaviour; REVIEW.md §3 lists what needs a person on a real Windows machine |
