# Issue 100 delivery evidence

DailyXP settings now replay from `settings.changed` events. Existing desktop profiles receive one migration event. The stored settings field is a derived compatibility cache. Reduced motion saves immediately. Numeric settings use native form validation and an explicit save. A focused draft survives live companion updates while navigation uses the latest Session state.

Export JSON writes a canonical journal directly accepted by `EventModel.loadJournal`. Its optional FNV checksum detects accidental corruption, consistent with the existing envelope checksum. It is not a cryptographic signature. Old bare journals remain compatible. The legacy storage-envelope export remains available. Both formats include private Recovery data and settings. Files are replaced atomically with mode 0600, including existing permissive destinations. Import preflights every projection before changing disk.

Reset requires a separate confirmation and defaults to Cancel. Before reset, the core writes `reset-backup-UUID.json` in the profile. A failed recovery-copy write prevents reset. A successful reset returns empty progress and default settings. The archive remains on disk for recovery. No personal profile was reset during this work.

The companion shows level and rank when idle, focused minutes when running, and explicit Paused text while paused. An active Session takes precedence over XP feedback. No host-shell code changed.

## Validation

- `npm test` passed 214 tests. Seven Settings regressions cover event replay, corruption, failed writes, migration, reset, saved boundary occurrence identity and Session slicing, rejected import preservation, and export permissions.
- `npm run lint` passed without warnings. Scoped `qmllint -I /tmp/dailyxp100-source-1/imports integrations/omarchy/BarWidget.qml` passed. Companion plugin validation passed. Eight Python root verifier tests passed.
- The source real-app journey passed at `/tmp/dailyxp100-source-2`. The final packaged real Electron and Omarchy companion journey passed at `/tmp/dailyxp100-packaged-reviewed`. Both started from empty disposable state on private Wayland. `report.json`, action logs, screenshots, canonical export, persisted profiles and `cleanup.json` remain in those directories.
- The final packaged journey used real forms and the native export dialog. It tested invalid numeric input, duplicate save, a real read-only-directory save failure, preserved draft text, settings restart, immediate reduced motion, keyboard focus at 620px, external companion pause during a focused settings draft, actual canonical export and clean-directory replay, Reset Cancel through Enter, Escape and reopen, reset and another empty-state restart. The existing full journey also covers native backup import, Sessions, Habit XP, Routine entry, World, Recovery and hard-kill replay.
- Independent review found an invalid-settings import that could poison startup. The fix preflights settings and every projection before commit. The exact rejected-import disk/live/restart regression passes. Independent review approved the fix at `50cb581`. The final independent check of `50071ca` and its guide is recorded on the issue.

## Design and simplification

The `how` and `architect` passes ran sequentially under AGENTS.md. The choice was between keeping settings beside storage and adding settings to the journal. A small pure SettingsModel makes save, replay and export use one representation. Simplification reused the existing intent adapter, atomic writer and native dialogs. The comment pass found no new explanatory comments or suppressions. No extra animation or motion dependency was added.

| Before                                        | After                                               | Why                                                    |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Preferences absent from portable history      | Canonical settings events                           | Replay and export preserve the same preference values. |
| Reduce motion needed a separate save          | Immediate persisted toggle                          | Feedback matches the control action.                   |
| Invalid numbers could reach the click handler | Native validity check                               | Invalid input leaves state unchanged.                  |
| No reset or version                           | Cancel-first confirmation and version text          | Deliberate fresh start with a recovery copy.           |
| Symbol-only pause and feedback precedence     | Explicit paused state and active Session precedence | Live bar state stays visible.                          |

The changed controls have instant press feedback, visible keyboard focus and no animated entrance, layout transition or exit delay. Reduced-motion preference and the system media preference disable the existing pointer transform. Review-animations verdict is approve for these controls. Actual narrow and reset captures show reachable controls without horizontal overflow. The design-improve dependency skills audit, critique and polish were not installed. Their focused checks were performed sequentially in the main agent and covered by the independent review, rather than claiming those missing skills ran.

## Local review ownership

The last installed baseline was reviewed PR #111 revision `49b98c0`. Fresh baseline captures are retained at `/tmp/dailyxp100-installed-baseline`; its private processes were cleaned up.

Revision `50071ca` is installed at `~/.local/opt/dailyxp`. All 41 production source files match the intended revision. Installed and staged app.asar hashes match `328bb22d01e6683787189de0bb79f29f49e0943fe84b1394b9354dd17438bf8d`. Electron-builder rewrites development package metadata; packaged name, version and main entry match. A shell rescan retained stale bar QML. `omarchy restart shell` refreshed it, and the actual local bar visibly shows `Lv 1 · Wanderer`.

`~/.local/state/dailyxp-handoff-100` contains ownership, prior launchers, personal-state and previous-review backups, installed-source verification, and rendered native captures. The Settings page is visibly open with REVIEW PROFILE. Personal `desktop.json` and `desktop.backup.json` hashes match their backups.

Owned demo progress is in `~/.local/state/dailyxp-review-100`. It contains Task `review-100-task` and Habit `review-100-habit`, with one completed check and earned XP. The global DailyXP launchers and companion controller point to this profile. `dailyxp-review-100.service` owns the app with KillMode=mixed. The previous #99 service is stopped and its profile retained unchanged. Cleanup archives #100, restores the previous #99 launchers and restarts that review. Cleanup checks launcher ownership before changing it. It does not delete personal data or discard review edits.

## Limits

The installed Linux unpacked build passed. AppImage FUSE behavior, other distros, ARM64 and desktop notification delivery remain unverified. No QML application behavior changed beyond the companion widget. The root QML real-app journey was not rerun because this delivery uses Electron; the real Electron and companion journey plus scoped QML lint cover the changed path. No merge is authorized. The draft PR is stacked on #111 until that dependency receives Mohamed's manual approval.
