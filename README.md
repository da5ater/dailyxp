# DailyXP

DailyXP is an Omarchy-first life-gamification product for focused work, goals,
habits, recovery, social competition, and a persistent comeback story.

The full Linux application now lives in [apps/desktop](apps/desktop/README.md).
It uses Electron with the existing deterministic domain models and journal.
The optional [Omarchy companion](integrations/omarchy) provides compact status,
open and pause/resume controls. Build, install, migration and verification
instructions are in the desktop guide. Mohamed selected the Quest cartridge
PS1 adventure direction for this application.

The original QML panel and state service remain in the repository for legacy
rollback and regression verification. The requirements below describe that
legacy plugin. Do not run its state-owning service alongside the companion
during migration.

## Requirements

- Omarchy 4 / Quattro with the Omarchy shell plugin host
- `mkdir` and `readlink` from GNU coreutils, used without root access to create
  the XDG state directory and resolve the system IANA timezone
- `notify-send`, included by Omarchy, for actionable local Session reminders

DailyXP starts no external daemon, installer, privileged command, or second
Quickshell process. Its headless QML service runs once inside the existing
Omarchy shell process, whose plugin code runs unsandboxed.

## Install

Review the repository first, then install and enable it:

```sh
omarchy plugin add https://github.com/da5ater/dailyxp.git --enable
```

For a user-owned development copy, place the repository at
`~/.config/omarchy/plugins/io.github.da5ater.dailyxp`, then run:

```sh
omarchy plugin validate ~/.config/omarchy/plugins/io.github.da5ater.dailyxp
omarchy-shell shell rescanPlugins
omarchy plugin enable io.github.da5ater.dailyxp
```

## Data and removal

Durable local state lives under `$XDG_STATE_HOME/dailyxp/`, falling back to
`~/.local/state/dailyxp/`. It contains a checksum-protected primary/backup
envelope and a canonical versioned event journal. Removing the plugin leaves
this user-owned state in place so reinstalling does not erase progress.

```sh
omarchy plugin remove io.github.da5ater.dailyxp
```

To permanently erase DailyXP data, remove the exact state directory separately
after checking its contents. DailyXP never edits unrelated Omarchy settings.

## Verify

```sh
omarchy plugin validate .
/usr/lib/qt6/bin/qmllint -I /usr/share/omarchy/shell \
  BarWidget.qml Panel.qml StateStore.qml
node --test tests/*.test.js
```

The temporary foundation probe can also be exercised without pointer input:

```sh
omarchy-shell io.github.da5ater.dailyxp addProbe
```

The idempotent planning-day lifecycle can be requested independently. When an
advance is needed, the request starts an asynchronous atomic save, so read its
status afterward rather than treating the request response as persistence
confirmation:

```sh
omarchy-shell io.github.da5ater.dailyxp ensurePlanningDay
omarchy-shell io.github.da5ater.dailyxp planningDayStatus
```

Inspect the current selected work and Session state without opening the panel:

```sh
omarchy-shell io.github.da5ater.dailyxp sessionStatus
```

## License

DailyXP is licensed under GPL-3.0-or-later. See `LICENSE`.
