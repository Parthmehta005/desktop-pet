# Desktop Pet: quick guide

A pet that walks along your taskbar and reacts to Claude Code, your coding and your apps.

## Set up

1. **Get the app.** Download [DesktopPet-Setup.exe][setup] and run it. If Windows
   warns you, click **More info**, then **Run anyway**.
2. **Find it.** The pet appears just above the taskbar. Its icon is in the tray by the
   clock (click **^** if you can't see it). Click the icon for the menu.
3. **Connect Claude Code.** Skip this if you don't use it. In the tray menu click
   **Install Claude Code hooks**, then start a new Claude Code session.
4. **Optional.** Tray menu → **Settings...**:
   - **Watched folders** → **Add folder...** for each folder you code in.
   - **Start when I sign in**, to have the pet every day.

Using Claude Code inside WSL, or would rather build from source? See the
[README](README.md#windows-setup).

## Use it

| To | Do this |
|---|---|
| Hide or show the pet | Press **Ctrl+Alt+P**, or tray → **Hide pet** / **Show pet** |
| Pet it | Click it |
| Move it | Drag it, then let go |
| Change the pet | Tray → **Pet** |
| Stop it reacting for a while | Tray → **Pause reactions** |
| See its reactions | Tray → **Test reactions** |
| Change anything else | Tray → **Settings...** |
| See your version | The top line of the tray menu. What's new: [CHANGELOG.md](CHANGELOG.md) |
| Update it | Quit it, download [DesktopPet-Setup.exe][setup] again and run it. Settings stay |
| Quit | Tray → **Quit Desktop Pet** |

## What it reacts to

- **Claude Code:** sweats while Claude works, waves "Need you!" when Claude is waiting
  for you, and says "Done!" when it finishes.
- **You:** sleeps after 5 minutes idle or when you lock the screen, and says "Hi!" when
  you're back. Nudges you to stretch after 90 minutes, and wears a nightcap after 00:30.
- **Your code:** in watched folders, it types while you edit and throws confetti when
  you commit.
- **Your apps:** headphones for music, popcorn for YouTube and Netflix, a controller for
  games, quiet during meetings, and out of the way when something is fullscreen.
- **Your battery:** unplugged at 10% or less, it runs to the battery icon in the corner and
  panics. Click it to open battery settings, or plug in to calm it.

## If something's off

- **A black or white box around the pet:** tray → **Settings...** →
  **Turn off hardware acceleration**, then quit and start the pet again.
- **No reaction to Claude:** the tray menu should say **Claude Code: connected**. Start a
  new Claude Code session after installing the hooks.
- **The pet is gone:** press **Ctrl+Alt+P**.

More help: [README → Troubleshooting](README.md#troubleshooting).

## Uninstall

1. Tray → **Remove Claude Code hooks**.
2. Tray → **Quit Desktop Pet**.
3. Windows **Settings** → **Apps** → **Desktop Pet** → **Uninstall**.

[setup]: https://github.com/Parthmehta005/desktop-pet/releases/latest/download/DesktopPet-Setup.exe
