# CLAUDE.md

Working notes for Claude on this repo. Keep this file short and current: update it in the
same commit whenever a decision, convention or command changes.

## Read first
- **[ROADMAP.md](ROADMAP.md)** is the source of truth for the plan, the milestone status
  table, and the canonical pet IDs and state IDs. Check the status table to see where
  work stands before doing anything. M0 to M12 are done and merged into `main`; new work
  starts from the ROADMAP backlog as a new milestone (M13 on), planned and reviewed the
  same way. When a milestone's gate passes and CI is green, fast-forward `main` to the
  branch (the user asked for this) and notify them.
- **[REVIEW.md](REVIEW.md)** is the gate every milestone must pass. Results go in its §4
  review log.
- **[GUIDE.md](GUIDE.md)** is the one-page user guide. Keep it at most 80 lines and
  name UI items exactly as the app does; `test/unit/guide.test.js` checks both, and
  `test/electron/guide.spec.js` follows it in the app. Update it when the UI changes.
- **[README.md](README.md)** is for the user. Fill in its sections as the milestones that
  own them finish. Each placeholder says which milestone that is.

## How to work here
- **One milestone at a time, in order.** Set its status to `In progress` when starting
  and `Done` when the gate passes.
- **Incremental commits.** Each commit is one logical step and passes `npm run lint` and
  every test suite that exists at that point on its own. Messages start with the
  milestone: `M3: add Pip the penguin`. Follow the planned commit list in ROADMAP.md; if
  the list has to change, update ROADMAP.md too.
- **Branch:** `ccr-f206000e-0v0714`. Push at least at the end of every milestone. No pull
  requests unless the user asks.
- **End of a milestone:**
  1. Run REVIEW.md §1 and that milestone's §2 section.
  2. Add a row to the review log.
  3. Update the ROADMAP status and the README sections.
  4. Push, then report to the user: what was built, the test results, what couldn't be
     verified on Linux, and any known issues.
  5. Then continue to the next milestone, unless the user asked to pause, a gate fails
     for a reason that can't be fixed, or a decision is the user's to make.
     After M1 the user asked for M2 to M9 to run straight through, stopping only for a
     real blocker.
- **Scope creep** goes in the ROADMAP backlog, never into the current milestone.
- **Versions:** semver, in `package.json`. Every user-visible change adds a line under
  `## [Unreleased]` in `CHANGELOG.md`. To release: `npm version X.Y.Z
  --no-git-tag-version`, move Unreleased to `## [X.Y.Z] - date`, merge to `main`, then
  push tag `vX.Y.Z` on `main` (README "Versions and releases"). `release.yml` publishes
  `DesktopPet-Setup.exe` and `DesktopPet-Portable.exe`; the download links depend on
  those names, and `test/unit/release.test.js` checks them.
- Never skip, disable or `.only` a test to get a pass.
- Decide whether to commit from the real exit codes of lint and every test suite. Never
  pipe a test command into `tail` or `grep` and then chain `&& git commit`: the pipe hides
  the failure.
- Tests must not depend on the time of day. The bedtime window (00:30 to 06:00 by
  default) changes the mood. Use fixed times (`T0`, `?time=12:00`) or `bedtime: null`.

## Decisions already made (don't reopen these)
- **Claude detection uses Claude Code hooks**, not transcript parsing. Each hook is a
  one-line `curl` that POSTs the hook's JSON to `127.0.0.1:<port>` with an
  `X-Pet-Token` header, has a 2s timeout, and never blocks Claude.
- **Support Claude Code both natively on Windows and inside WSL.** That means handling
  `/mnt/c/...` paths and documenting the WSL networking step.
- **Art:** an SVG rig with shared part names, animated with CSS, using only `transform`
  and `opacity`. No pixel art, no bitmaps.
- **6 pets, all 19 states each** (the 19th, `low-battery`, came in M12): `cat` Mochi, `corgi` Biscuit, `penguin` Pip, `axolotl`
  Axo, `robot` Bolt, `softbot` Nimbus.
- **Nimbus** stands in for the Baymax the user asked for. It must stay an original design:
  pale lavender, an LED visor face, a glowing chest heart. Never make it white with a
  dots-and-line face, or otherwise resemble Baymax or any other franchise character. The
  same rule applies to all art and names.
- **Stack:** Electron 45, plain ES modules, no bundler. The only runtime dependency is
  `chokidar`. Tests use `node:test` and Playwright; lint uses an ESLint flat config;
  packaging uses `electron-builder` (NSIS installer and portable `.exe`).
- **CI:** GitHub Actions on `ubuntu-latest` and `windows-latest`, from M1 on.

## Architecture rules
- `src/core/` is pure: it imports only other `src/core` modules (no `node:*`, Electron,
  DOM or npm packages) and uses no `process`/`window` globals. It runs in the main
  process, the renderer, the browser preview and the tests. ESLint and
  `test/unit/core-purity.test.js` both enforce this.
- The engine is a reducer: `reduce(state, event, now)` and `selectMood(state, now)`.
  The event types are documented at the top of `src/core/engine.js`. The engine trusts
  its config, so validate with `src/core/config.js` first.
- The renderer code is the same in the browser preview and in Electron. Anything
  Electron-specific goes through the preload bridge only.
- Windows-only code (the foreground-app monitor) sits behind a `process.platform` check
  with a no-op fallback.
- Electron security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  a content security policy, no remote content, and IPC handlers that validate input.
- **Paths:** outside `src/core`, use `path` helpers and never hard-code separators.
  Inside `src/core`, `paths.js` does its own Windows/WSL/POSIX handling because
  `node:path` isn't available in the browser. Use its `isInside()` and
  `findContainingFolder()` for every "is this in a watched folder?" question.
- **Main process:** windows load `app://desktop-pet/<dir>/<file>`, served from
  `src/renderer` and `src/core` only (`src/main/app-paths.js`). Every event for the pet
  goes through the event bus (`src/main/event-bus.js`), with a `source` so pausing can
  drop it. Tests reach the main process through `globalThis.__desktopPet`, which only
  exists when `DESKTOP_PET_TEST=1`.
- **Packaging:** `build.files` in `package.json` lists what ships in the app's asar
  archive. Anything read at runtime (pages, icons, `foreground.ps1`) must be listed;
  `test/packaged` checks the built app finds them.
- **Hook server:** binds to `127.0.0.1` only, requires the token, limits body size, and
  replies `204` with an **empty body**. A hook's output can end up in Claude's context.
- **Hooks installer:**
  - Backs up `settings.json` and writes it atomically.
  - Keeps the user's other hooks and settings.
  - Is safe to run twice, and marks its own entries so uninstall removes only those.
  - Refuses to touch malformed JSON.
- **Tests never touch the user's real `~/.claude` or app data.** Use a temporary HOME
  and a temporary `userData`.

## Commands
Each is added by the milestone shown.

| Command | Added in | Does |
|---|---|---|
| `npm run lint` | M1 | ESLint |
| `npm test` | M1 | Unit tests (`node:test`) |
| `npm run preview` | M2 | Serves the browser preview page |
| `npm run test:browser` | M2 | Playwright tests against the preview |
| `npm start` | M5 | Runs the Electron app |
| `npm run test:electron` | M5 | Electron tests under `xvfb-run` |
| `npm run test:all` | M5 | Every suite |
| `npm run hooks:install` / `hooks:uninstall` / `hooks:status` | M6 | Manage the Claude Code hooks (`-- --settings <file> --user-data <dir> --wsl --host <h>`) |
| `npm run build:icons` | M5 | Re-renders `assets/*.png` from the SVGs |
| `npm run dist:win` | M9 | Builds the Windows installer and portable `.exe` (Windows; needs Wine elsewhere) |
| `npm run dist:dir` | M9 | Builds the unpacked app for this OS into `dist/` |
| `npm run test:packaged` | M9 | Playwright tests against the built app (after `dist:dir` or `dist:win`) |
| `node scripts/release.js check vX.Y.Z` / `notes X.Y.Z` | M13 | Checks a release tag against `package.json` and the changelog / prints its release notes |

## Windows notes
- Replacing a file by renaming over it fails for a moment on Windows while anything else
  has it open; use `src/main/safe-rename.js` for every atomic settings write.
- There's no PowerShell or C# compiler in the container: `test/windows/foreground.test.js`
  runs the real monitor script on Windows CI. Its first start on a fresh machine can take
  over 10s.

## Environment notes (cloud container)
- Node 22 and npm 10.
- Chromium and Playwright 1.63.0 are preinstalled in `/opt/pw-browsers`; don't run
  `playwright install` here. `@playwright/test` is pinned to `1.63.0` to match those
  browsers. CI installs its own copy with `npx playwright install --with-deps chromium`.
- Run Playwright with `--trace off`. With npm that's `npm run test:browser -- --trace off`.
- `xvfb-run` is available for the Electron tests, and the Electron binary download from
  GitHub works.
- Check CI with the GitHub MCP tools (`mcp__github__actions_list`, `get_job_logs`).
  There's no `gh` CLI apart from search.
- Screenshots only I look at use `deviceScaleFactor: 1`; ones meant for the user use 2.
  Look at every screenshot the REVIEW gate asks for; don't just generate it.

## About the user
- Wants a plan approved before any code, and the work split into milestones that Claude
  reviews and tests itself.
- Likes variety: several pets, lots of animations, extra scenarios such as moods for
  particular apps.
- Develops on Windows, and may run Claude Code natively or in WSL.
