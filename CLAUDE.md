# CLAUDE.md

Working notes for Claude on this repo. Keep this file short and current: update it in the
same commit whenever a decision, convention or command changes.

## Read first
- **[ROADMAP.md](ROADMAP.md)** is the source of truth for the plan, the milestone status
  table, and the canonical pet IDs and state IDs. Check the status table to see where
  work stands before doing anything.
- **[REVIEW.md](REVIEW.md)** is the gate every milestone must pass. Results go in its §4
  review log.
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
- **Scope creep** goes in the ROADMAP backlog, never into the current milestone.
- Never skip, disable or `.only` a test to get a pass.

## Decisions already made (don't reopen these)
- **Claude detection uses Claude Code hooks**, not transcript parsing. Each hook is a
  one-line `curl` that POSTs the hook's JSON to `127.0.0.1:<port>` with an
  `X-Pet-Token` header, has a 2s timeout, and never blocks Claude.
- **Support Claude Code both natively on Windows and inside WSL.** That means handling
  `/mnt/c/...` paths and documenting the WSL networking step.
- **Art:** an SVG rig with shared part names, animated with CSS, using only `transform`
  and `opacity`. No pixel art, no bitmaps.
- **6 pets, all 18 states each:** `cat` Mochi, `corgi` Biscuit, `penguin` Pip, `axolotl`
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
- `src/core/` is pure: no DOM, Electron, `fs` or network imports. The app, the preview
  page and the tests all use it.
- The renderer code is the same in the browser preview and in Electron. Anything
  Electron-specific goes through the preload bridge only.
- Windows-only code (the foreground-app monitor) sits behind a `process.platform` check
  with a no-op fallback.
- Electron security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  a content security policy, no remote content, and IPC handlers that validate input.
- **Paths:** use `path` helpers; never hard-code separators. Cross-platform logic tests
  use `path.win32` and `path.posix` explicitly.
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
| `npm run hooks:install` / `hooks:uninstall` / `hooks:status` | M6 | Manage the Claude Code hooks |
| `npm run dist:win` | M9 | Builds the Windows installer and portable `.exe` |

## Environment notes (cloud container)
- Node 22 and npm 10.
- Chromium and Playwright are preinstalled; don't run `playwright install`. If the
  project's `@playwright/test` version doesn't find the browser, launch with
  `executablePath: '/opt/pw-browsers/chromium'`.
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
