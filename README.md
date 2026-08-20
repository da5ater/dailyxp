# DailyXP

DailyXP is an Omarchy-first life-gamification product for focused work, goals,
habits, recovery, social competition, and a persistent comeback story.

This repository currently contains the installable Omarchy Quattro foundation:
a bar widget, its nested panel, and a fault-tolerant local state primitive. The
probe button is intentionally temporary; product workflows arrive in later
tickets. The versioned offline journal contract is documented in
[`docs/event-model.md`](docs/event-model.md).

## Requirements

- Omarchy 4 / Quattro with the Omarchy shell plugin host
- `mkdir` from GNU coreutils, used without root access to create the XDG state
  directory

DailyXP starts no service, installer, privileged command, or second Quickshell
process. Plugin QML runs unsandboxed inside the existing Omarchy shell process.

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
`~/.local/state/dailyxp/`. Removing the plugin leaves this user-owned state in
place so reinstalling does not erase progress.

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
node --test tests/state_model.test.js
```

The temporary foundation probe can also be exercised without pointer input:

```sh
omarchy-shell io.github.da5ater.dailyxp addProbe
```

## License

DailyXP is licensed under GPL-3.0-or-later. See `LICENSE`.
