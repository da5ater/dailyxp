# DailyXP for Linux

DailyXP runs as an Electron application. Omarchy is an optional compact integration. The core preserves the existing domain models and journal format.

## Run from source

Use Node.js 22 or later. From the repository root, run `npm ci`, then `npm start`. The app stores its profile in `$XDG_STATE_HOME/dailyxp-desktop`, or `~/.local/state/dailyxp-desktop`. Set `DAILYXP_PROFILE` to a separate directory for review or automation.

Mohamed selected Quest cartridge, a dark PS1 adventure direction with local castle artwork and pixel display type. Body text and controls remain readable at normal desktop sizes.

## Install the Linux build

Build with `npm run package:linux`. The outputs are an AppImage and a tar.gz archive. Extract the archive, then run its `./install.sh`. This installs the bundled Electron runtime and launchers under `~/.local`, without Node.js or a package-manager installation. A previous application installation is moved to a dated backup.

The Linux runtime needs standard Electron desktop libraries, including glibc, GTK, NSS, ALSA and GBM. The core also needs the `flock` command from util-linux. AppImage execution may need FUSE. Use the extracted archive when FUSE is unavailable. The current build is x86-64. ARM64 and other distro environments require separate builds and verification before support is claimed.

The installer does not modify your Omarchy plugin or personal progress. The packaged companion is in `resources/omarchy-companion`. Its installation must back up the old plugin and state, validate the replacement, reload the shell, and confirm the actual rendering. See the repository's local handoff instructions.

## Keep the application connected

Closing the window hides it so a Session and its companion remain connected. Open DailyXP from your application launcher or `dailyxpctl open`. Quit through DailyXP → Quit DailyXP or Ctrl+Q to stop the process. `dailyxpctl status`, `pause` and `resume` use the private integration socket.

## Move existing progress

Quit the old plugin host or replace its full state-owning plugin with the companion first. Back up its plugin files and `~/.local/state/dailyxp` directory. In an empty desktop profile, open Settings and choose Import legacy state. Select the backed-up `state.json`. The app validates and copies the journal. It never edits the source.

Export backup writes a legacy-compatible progress envelope containing private data. Desktop preferences are stored in the desktop profile and are not part of that legacy envelope. Back up the full profile directory when preserving both progress and preferences.

Rollback restores the old plugin and its unchanged state. Desktop work recorded after import remains in the new profile. Export it before rollback and reconcile it before returning to legacy editing. Never run two state-owning clients against the same progress.

## Verify changes

Run `npm test` and `npm run lint`, then follow [.agents/skills/verify/SKILL.md](.agents/skills/verify/SKILL.md). The driver uses a real private-display Electron process and companion. It retains screenshots, actions and persisted state after cleanup. The existing repository verifier remains available for legacy QML regressions.
