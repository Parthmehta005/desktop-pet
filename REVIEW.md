# Review checklist

This is the definition of done for each milestone in [ROADMAP.md](ROADMAP.md). At the end
of every milestone I run **§1 (the universal gate)** and **that milestone's section in §2**,
then record the result in **§4 (review log)**. A milestone isn't `Done` until every box in
both sections is ticked, or an exception is written in the log with the reason.

§3 lists the checks that need a person on a real Windows machine. Those happen once the
app is complete.

---

## 1. Universal gate (every milestone)

### A. Repository
- [ ] The working tree is clean and every commit is pushed to `ccr-f206000e-0v0714`.
- [ ] Commits are incremental. Each is one logical step, its message starts with the
      milestone (`M4: …`), and none mixes work from two milestones.
- [ ] **Every commit passes on its own.** For each commit in the milestone:
      `git checkout <sha> && npm ci && npm run lint && npm test` succeeds. From M2 on this
      includes `npm run test:browser`, and from M5 on `npm run test:electron`, for the
      commits where those suites exist.
- [ ] No generated output, `node_modules`, secrets, tokens or personal paths are
      committed.

### B. Automated tests (on the final commit, from a clean `npm ci`)
| Command | From | Must |
|---|---|---|
| `npm run lint` | M1 | No errors or warnings |
| `npm test` (unit, `node:test`) | M1 | All pass, including every earlier milestone's tests |
| `npm run test:browser` (Playwright, preview page) | M2 | All pass, with no console errors or page errors |
| `npm run test:electron` (Playwright `_electron`, `xvfb-run`) | M5 | All pass |
| `npm run test:all` | M5 | Runs all of the above |

- [ ] The tests added in this milestone cover its new behaviour, including the error
      paths, not just the happy path.
- [ ] No test is skipped, marked `.only`, or disabled to get a pass.
- [ ] No flaky tests: run the full suite 3 times in a row and all 3 pass.

### C. CI
- [ ] The GitHub Actions run for the final commit is green on `ubuntu-latest` and
      `windows-latest`. If Actions isn't available, record that in the log.

### D. Self code review of the milestone diff
- [ ] Correctness: re-read the whole diff against the milestone goals in ROADMAP.md.
- [ ] Boundary respected: nothing from a later milestone slipped in, and nothing the
      ROADMAP says is out of scope.
- [ ] `src/core/` stays pure: no DOM, Electron, `fs` or network imports.
- [ ] Cross-platform: paths use `path` helpers, there are no hard-coded `/` or `\`
      separators, and Windows-only code sits behind a `process.platform` check with a
      no-op fallback.
- [ ] No dead code, leftover debug logging, or commented-out blocks.
- [ ] Art and assets are original. No copyrighted characters, logos or third-party
      sprites.
- [ ] Dependencies: anything new is justified, pinned in the lockfile, and recorded in
      the ROADMAP tech choices.

### E. Security (from M5 on)
- [ ] Every window has `contextIsolation: true`, `sandbox: true` and
      `nodeIntegration: false`, and a content security policy. No remote content loads.
- [ ] IPC handlers validate their inputs, and the preload exposes only named functions.
- [ ] (M6 on) The hook server binds to `127.0.0.1` only, requires the token, limits body
      size, and returns an empty body.
- [ ] (M6 on) User files such as `~/.claude/settings.json` are backed up before they're
      written, and written atomically.

### F. Docs
- [ ] The ROADMAP status table is updated.
- [ ] `CLAUDE.md` is updated if a decision, convention or command changed.
- [ ] The README sections this milestone affects are updated (from M5 on, as the app
      becomes usable).
- [ ] The review log entry is added (§4).

### G. Hand-off
- [ ] A short report: what was built, the test results, what couldn't be verified on
      Linux, and any known issues or backlog items it produced.

---

## 2. Milestone-specific checks

### M1 — Project scaffold and core logic
- [x] `npm ci` works from a clean clone with Node 22.
- [x] Every one of the 18 state IDs can be reached through a sequence of engine events
      in a unit test, and so can both modifiers.
- [x] Priority: for each pair of states that can both apply, a test shows the
      higher-priority one wins.
- [x] Timed states (`happy`, `celebrating`, `greeting`, `petted`) expire at their
      duration with a fake clock, and fall back to the right state.
- [x] Claude sessions:
  - [x] Two sessions running and one stopping → a brief `happy`, then back to
        `working` at intensity 1.
  - [x] `working` intensity is 1, 2 and 3 for 1, 2 and 3+ sessions.
  - [x] A stale session (no events for `workingStaleMinutes`) stops counting.
  - [x] `alert` clears on `PostToolUse` and on `UserPromptSubmit`.
  - [x] An idle-prompt `Notification` doesn't trigger `alert`.
  - [x] `Stop` while idle → `away-done`; returning → `happy` → `wander`.
- [x] Path matching:
  - [x] `C:\Code\App` matches `c:/code/app/src`.
  - [x] `C:\code\app` does **not** match `C:\code\app2`.
  - [x] Trailing separators are handled.
  - [x] `/mnt/c/code/app` matches `C:\code\app`.
  - [x] POSIX paths match case-sensitively.
- [x] App rules: process-name and title regexes match; an invalid regex is rejected by
      config validation rather than crashing.
- [x] Walker:
  - [x] It never goes outside `[0, width - petWidth]` across 10,000 random steps.
  - [x] It turns around at the edges.
  - [x] Its speed is 0 in `sleeping`, `meeting`, `held` and `away-done`.
  - [x] A width change mid-walk clamps the position.
- [x] Config: defaults are valid; unknown keys are dropped; bad values fall back to the
      defaults with a reported error; migration from version 0 to the current version
      works.
- [x] CI workflow file is present and green on both operating systems.

### M2 — Pet rig, first pet, every animation
- [x] `npm run preview` serves the gallery, and the browser tests open it.
- [x] The gallery has exactly one cell per state ID from `moods.js`, so a missing
      animation fails the test.
- [x] Each cell renders an `<svg>` with the standard rig parts and the props that state
      needs (for example sweat in `working`, Zzz in `sleeping`, hearts in `petted`).
- [x] `working` shows a different amount of sweat at intensities 1, 2 and 3.
- [x] No console errors, page errors or failed network requests.
- [x] A screenshot of each state is saved, and I've **looked at every one**: the pet is
      recognisable, nothing is clipped, the props sit in the right place, and the pet
      reads well on both a light and a dark background.
- [x] The animations are smooth: no layout-triggering properties are animated (only
      `transform` and `opacity`).
- [x] The pet definition format is documented in the rig source, ready for M3.

### M3 — The other five pets
- [x] The gallery shows 6 pets × 18 states = 108 cells, and all of them pass the M2 cell
      checks.
- [x] Every pet has the same bounding box and ground baseline, checked by a test
      measuring each pet's SVG bounding box.
- [x] Each pet's signature touch is visible in its `wander` state.
- [x] I've looked at the screenshots for every pet: they look distinct from each other,
      and nothing is clipped at any state.
- [x] Nimbus is an original design and doesn't resemble an existing franchise character.

### M4 — Interactive browser preview
- [x] Each stage button produces the expected state (one browser test per event).
- [x] Event sequences:
  - [x] Claude start → permission → tool result → stop gives
        `working → alert → working → happy → wander`.
  - [x] Claude start → go idle → stop → return gives
        `working → away-done → happy`.
- [x] The time-speed control makes `sleeping` and `stretch` reachable within a few
      seconds.
- [x] Walking: the pet stays inside the stage at 320px, 1280px and 3840px wide, and when
      the window is resized while it walks.
- [x] Pointer:
  - [x] Click → `petted`.
  - [x] Drag → `held`, and the pet follows the pointer.
  - [x] Release mid-air → `falling`, then it lands on the baseline.
  - [x] It can't be dropped outside the stage.
- [x] `meeting` hides bubbles and lowers opacity; `hidden` hides the pet; both restore
      when cleared.
- [x] The pet picker swaps the pet without resetting the current state.
- [x] Light and dark wallpaper toggle works; screenshot reviewed for both.

### M5 — Electron shell
- [x] The app launches under `xvfb-run`, and a second launch exits because of the
      single-instance lock.
- [x] The pet window is transparent, frameless, always-on-top and hidden from the
      taskbar, and its bounds are on the primary display's work area along the bottom.
      Properties are checked through Playwright `_electron`.
- [x] The renderer is the same M4 controller: no Electron-specific branches beyond the
      preload bridge.
- [x] Click-through: with the cursor away from the pet, the window ignores mouse events;
      over the pet, it accepts them. Checked by IPC state in a test.
- [x] Each tray "test reactions" item changes the pet's state.
- [x] Config store:
  - [x] It's created with defaults on first run.
  - [x] A corrupt file is moved aside and replaced with the defaults.
  - [x] A pet change from the tray survives a restart.
- [x] Display changes (simulated) move and resize the strip.
- [x] Resource check: memory and CPU from `app.getAppMetrics()` are recorded in the log.
      Under xvfb this uses software rendering, so it's a sanity check, not a target.
- [x] Security section E passes.

### M6 — Claude Code integration
- [x] Hook server tests:
  - [x] Missing or wrong token → 401.
  - [x] Bad JSON → 400.
  - [x] An oversized body is rejected.
  - [x] A valid event → 204 with an empty body.
  - [x] The server isn't reachable on any address except `127.0.0.1`.
- [x] Events from a `cwd` outside the watched folders are ignored, unless "react to all"
      is on.
- [x] A Windows `cwd` from a real hook payload matches a watched folder configured in a
      different letter case.
- [x] Installer, against a temporary HOME:
  - [x] It creates `settings.json` if it's missing.
  - [x] It keeps existing hooks and other settings.
  - [x] A second install changes nothing.
  - [x] Uninstall gives a file equivalent to the original.
  - [x] A backup file is created.
  - [x] It refuses to touch malformed JSON.
- [x] `npm run hooks:status` reports installed, not installed, and port/token mismatch
      correctly.
- [x] End-to-end: the installed hook command, run through a real shell with recorded
      payloads, moves the Electron pet through `working → alert → working → happy`.
- [x] With the pet **not running**, the hook command exits within its timeout and
      without blocking (time measured).
- [x] Security section E (hook server and settings writes) passes.

### M7 — Local activity sources
- [x] Repo watcher, using temporary folders:
  - [x] A file edit → an activity event, debounced so a burst of edits counts once.
  - [x] Edits under `node_modules`, `dist` or `.git/objects` → no event.
  - [x] Adding or removing a watched folder at runtime is respected.
- [x] Commit detection, using real temporary git repos:
  - [x] A new commit → `celebrating`.
  - [x] `git checkout` and `git status` → no celebration.
  - [x] It works in a worktree.
- [x] Idle monitor, with a fake `powerMonitor`:
  - [x] It crosses the threshold → `sleeping`.
  - [x] Lock → `sleeping`; unlock → `greeting`.
  - [x] 90 minutes active without a break → `stretch`.
- [x] App monitor:
  - [x] Recorded JSON lines are parsed into app events.
  - [x] Garbage lines are ignored.
  - [x] If the child process crashes, it restarts with backoff.
  - [x] On non-Windows it does nothing and doesn't spawn a process.
- [x] The PowerShell script is reviewed by reading it: no admin rights needed, no
      network, starts with `-NoProfile -ExecutionPolicy Bypass`, and polls at most once
      a second.
- [x] End-to-end in Electron: edit a file in a watched temporary repo → `focused`; commit
      → `celebrating`; simulated idle → `sleeping`.
- [x] Watcher CPU: with a watched folder of 10,000 files, the app stays idle with no
      events once the initial scan finishes.

### M8 — Settings window and polish
- [x] Every field in the config schema has a control in the settings window. A test
      compares the schema keys against the form fields.
- [x] Invalid input (for example a bad regex, or idle minutes of 0) is rejected with a
      message and never saved.
- [x] Adding a folder through the folder picker (stubbed in tests) saves it, and the
      watcher picks it up without a restart.
- [x] Changing the pet swaps it live, and shuffle daily picks a different pet when the
      date changes (fake clock).
- [x] The hooks panel shows the true status, and install/remove work from the UI.
- [x] Launch at login calls `app.setLoginItemSettings` (spied in tests).
- [x] Settings survive an app restart.
- [x] The settings window passes security section E.
- [x] Screenshot of the settings window reviewed.

### M9 — Packaging, Windows CI, final README
- [x] `electron-builder` produces an NSIS installer and a portable `.exe` on Windows CI,
      uploaded as artifacts.
- [x] Windows CI passes the unit tests, the Electron smoke test, and the foreground-app
      monitor smoke test (it prints at least one valid JSON line within 10s).
- [x] The README covers every section planned in the skeleton, and its setup steps work
      from a clean clone. The Linux-runnable steps are followed exactly by me; the
      Windows-only steps are checked by CI where possible.
- [x] A full-app code review is done, and its findings are fixed or logged in the
      backlog.
- [x] The ROADMAP status table shows every milestone `Done`.

### M10 — Quick hide and show
- [ ] The tray item hides the pet and then shows it again, and its label says which it
      will do.
- [ ] The default shortcut is registered at start; changing it in Settings registers the
      new one and frees the old one; clearing it turns it off.
- [ ] A shortcut that can't be registered (another app owns it) is reported in Settings,
      and the app carries on.
- [ ] Invalid shortcuts (no modifier, unknown keys) are rejected with a message and
      never saved.
- [ ] Events that arrive while the pet is hidden still change its mood: it is in the
      right state when shown.
- [ ] Starting the app again while the pet is hidden shows it.
- [ ] After a restart the pet is shown, whatever it was before.
- [ ] The settings window passes security section E, and its screenshot is reviewed.

---

## 3. Checks on a real Windows machine (for you, once the app is complete)

These can't be done from Linux or fully from CI.

1. The pet sits just above the taskbar and walks the full width, with the taskbar at the
   bottom, top, or set to auto-hide.
2. The window background is truly transparent: no black or white box behind the pet.
3. You can click the desktop and other windows through the strip, but not through the
   pet itself.
4. The pet stays on top of normal windows, and hides if an app goes fullscreen with
   "hide when fullscreen" on.
5. After installing the hooks and starting a new Claude Code session in a watched folder:
   - the pet sweats while Claude works
   - it waves when Claude asks for permission
   - it's happy when Claude finishes
6. The same works with Claude Code running in WSL, if you use it there. Follow the README
   WSL section.
7. Opening Spotify, Zoom or Teams, a Steam game, or YouTube changes the pet's mood.
8. Going idle for 5 minutes makes it sleep; locking and unlocking makes it greet you.
9. Launch at login starts the pet after you sign in again.
10. The installer installs cleanly and the app uninstalls cleanly. Uninstalling the hooks
    first restores `settings.json`.
11. Ctrl+Alt+P hides and shows the pet from any app, and so does the tray item.

---

## 4. Review log

One row per milestone, added when its gate passes. Exceptions and notes go in the last
column.

| Milestone | Final commit | Date | Lint | Unit | Browser | Electron | CI Linux | CI Windows | Notes |
|---|---|---|---|---|---|---|---|---|---|
| M0 | `cc7b618` | 2026-11-26 | n/a | n/a | n/a | n/a | n/a | n/a | Planning docs only. Approved by the user before M1 started |
| M1 | `804d034` | 2026-11-26 | Pass | 291/291, 3 runs in a row | n/a | n/a | Pass | Pass | All 11 M1 commits pass on their own from `npm ci`. 132 pairwise priority tests; only the two documented bedtime pairs switch the lower mood off. Changes from the plan: `stretch` now outranks `bedtime` (otherwise the break reminder could never appear late at night), and an `alertTimeoutMinutes` setting (default 30) was added so an unanswered alert can't stick forever. Review fixes: removed an unused engine parameter, corrected the purity rule in CLAUDE.md |
| M2 | `9c05023` | 2026-11-26 | Pass | 315/315, 3 runs in a row | 8/8, 3 runs in a row | n/a | Pass | Pass (unit on Windows, browser tests on Linux) | All 9 M2 commits pass lint, unit and browser tests on their own. I looked at the gallery at several animation frames and on both backgrounds; per-state screenshots are in `test-results/screenshots/`. Changes from the plan: `rig.js` and `props.js` are single files rather than folders; added a `headSize` anchor for headphones; landing squash is a `.landing` class the controller adds in M4 |
| M3 | `3497a25` | 2026-11-26 | Pass | 316/316, 3 runs in a row | 48/48, 3 runs in a row | n/a | Pass | Pass (unit on Windows, browser tests on Linux) | All 7 M3 commits pass lint, unit and browser tests on their own. I looked at every pet's full state grid and a side-by-side lineup on dark; all six are distinct. Nimbus is lavender with a cloud crest, mint ear pods, a dark LED visor and a chest heart. One slip: an M3 commit was first made with a failing test (the pipe hid the exit code); it was amended before pushing, and commits now go through a script that checks real exit codes |
| M4 | `437c4d4` | 2026-11-26 | Pass | 317/317, 3 runs in a row | 79/79, 3 runs in a row | n/a | Pass | Pass (unit on Windows, browser tests on Linux) | All 6 M4 commits pass on their own. The stage is its own page, `preview/stage.html`. For deterministic tests the stage takes `?time=HH:MM` (tests start at noon, so real-world bedtime can't leak in) and the controller keeps a short mood history (brief moods flash by at high clock speeds). Two first-run test failures were test-timing assumptions, not app bugs: a session going stale at 1 hour/second, and a 12s reminder lasting milliseconds. Screenshots of both wallpapers reviewed. README "Browser preview" section written |
| M5 | `7f3c951` | 2026-11-26 | Pass | 337/337, 3 runs in a row | 79/79, 3 runs in a row | 26/26, 3 runs in a row | Pass (unit + Electron on Linux) | Pass (unit) | All 7 M5 commits pass every suite on their own. Resource use under xvfb with software rendering: about 3% CPU and 560 MB across 4 Electron processes while wandering (`test-results/electron-metrics.json`). The window screenshot was reviewed. Additions beyond the plan: windows load over a privileged `app://` protocol that only serves `src/renderer` and `src/core` (so CSP `'self'` works without `file://`); Chromium background networking is off; an engine `reset` event lets "Pause reactions" calm the pet at once. Test-only: Electron launches with `--no-sandbox` when running as root or on CI, never in the app. The Windows Electron smoke test comes in M9 as planned |
| M6 | `0817beb` | 2026-11-27 | Pass | 378/378, 3 runs in a row | 79/79, 3 runs in a row | 33/33, 3 runs in a row | Pass (unit, browser, Electron) | Pass (unit) | All 10 M6 commits pass every suite on their own. The per-commit re-run used `TZ=Pacific/Honolulu` (daytime) because commits before `acf4a1d` contain an M5 test that assumed daytime; the three full runs were at real UTC night time. Found and fixed along the way: that time-of-day test flaw (`acf4a1d`), and curl honouring `http_proxy` (the hook command now passes `--noproxy`). Additions: the settings folder is pinned to `<appData>/desktop-pet` so the command-line tool can find the token; `--wsl` installs; with no watched folders, every Claude session counts. Process slip: a commit was made with a failing test (the check output was piped, hiding its exit code); it was undone before pushing and redone after the fix |
| M7 | `7f525ce` | 2026-11-27 | Pass | 411/411, 3 runs in a row | 79/79, 3 runs in a row | 51/51, 3 runs in a row | Pass (unit, browser, Electron) | Pass (unit) | Every M7 commit passes every suite on its own, re-checked after the fixes below. The three full runs were at `c0327ef`, which includes all of M7 and the M8 work that came between its fixes. A 10,000-file folder: first scan about 1.1 s, then 0.3 ms of CPU over 3 s idle and no events. The PowerShell script was reviewed by reading: no admin rights or network, started with `-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand`, checks once a second, and exits with the pet; it runs for real on Windows CI in M9. CI found three real bugs after the M7 commits, each fixed with a test that fails on the old code: settings reported as saved before they were on disk (`5fb1d5f`), commits missed on Windows because paths were compared as raw strings (`0c83396`), and a commit made straight after another going unnoticed because chokidar drops a change within 50 ms of the last one (`7f525ce`). One gate run failed because two test runs shared ports; runs now pick free ports (`5043278`), and three quiet reruns were green |
| M8 | `97cad29` | 2026-11-27 | Pass | 411/411, 3 runs in a row | 79/79, 3 runs in a row | 51/51, 3 runs in a row | Pass (unit, browser, Electron) | Pass (unit) | Every M8 commit passes every suite on its own; the three full runs were at `c0327ef`, and the last commit (`97cad29`, CSS only) passed every suite too. The commit list was revised: the form is generated from one field list, so the window and the simple controls came together. The settings window's own tests found an accessibility bug (labels named the wrong element, and the folder and rule fields' titles replaced their buttons' names), fixed in `fd8eda5`. CI found two quick list edits losing one (each built on a stale copy of the settings); saves now run one at a time and build on the latest settings (`c0327ef`), tested with deliberately slowed saves that fail on the old code. The settings window screenshot was reviewed; the pet cards now sit in one row of six (`97cad29`). Launch at login is recorded rather than applied in tests, and the hooks panel is tested against a temporary Claude folder |
| M9 | `8aa5a75` | 2026-11-27 | Pass | 414/414, 3 runs in a row | 79/79, 3 runs in a row | 55/55, 3 runs in a row | Pass (unit, browser, Electron, built app) | Pass (unit, the whole Electron suite, installer and portable build, built-app tests) | Every M9 commit passes every suite on its own, including the new built-app suite. In the first set of three full runs, run 2 had one Electron failure while I was running other Electron tests on the same machine; that script didn't keep the output, so which test is unknown. Three more runs with nothing else running, keeping every log, were all green (414 unit, 79 browser, 55 Electron, 3 built-app), and the gate scripts now keep their logs. On Windows CI the whole Electron suite passes, electron-builder makes `DesktopPet-Setup-0.1.0.exe` and `DesktopPet-0.1.0-portable.exe` (uploaded as the `desktop-pet-windows` artifact), and the built app passes its tests, with the foreground-app monitor reporting in 3.6 s (limit 10 s). The README's Linux-runnable steps were followed from a fresh clone of the pushed branch (the README's clone command gets `main`, which has none of this until the branch is merged): clone, `npm install`, `npm start` (under xvfb, with `--no-sandbox` because the container runs as root), the preview, lint, unit tests, the hooks commands on temporary files, `dist:dir` with `test:packaged`, and `build:icons` (no changes). The full-app review found and fixed, each with a test that fails without the fix: the portable app registering its temporary copy to start at sign-in; a new hook port still showing the hooks as connected; hooks installed elsewhere not showing until a restart; a crashed pet page staying empty; a second launch doing nothing visible (it now opens the settings); a byte-order mark making config.json look corrupt and Claude's settings.json unreadable; and overlapping folder changes watching a folder twice and leaking watchers. The rest went to the backlog: hardening fuses, code signing, WSL hooks from the settings window, and remembering busy Claude sessions across a page reload. `npm audit`: no runtime advisories; one moderate advisory in a build-time dependency of electron-builder |
