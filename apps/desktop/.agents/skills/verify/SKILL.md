---
name: verify
description: Launch and drive the real DailyXP Electron core app and Omarchy companion on a private Wayland display. Use for desktop UI, persistence, migration, protocol, packaging and companion changes.
---

# Verify the DailyXP core application

Read [the feature map](features/README.md), then the relevant feature. This package-level driver complements the repository's QML verifier. It tests a real Electron process and production models, disk storage, preload and companion protocol. It never connects input to the personal desktop.

## Launch

Run from the repository root after `npm ci`. Requires Python 3, Quickshell, wtype and grim and the private Sway runtime prepared by the root QML verifier. On this host it is `~/.cache/dailyxp-verifier/sway-runtime`. If absent, run the root `.agents/skills/verify/scripts/setup_headless.py`. Do not install a system compositor or fall back to the user's display.

```sh
node apps/desktop/scripts/verify.cjs run /tmp/dailyxp-electron-review-UNIQUE
```

Choose a nonexistent directory. The helper exclusively creates it, launches its own headless compositor, starts Electron with `DAILYXP_PROFILE=RUN/profile`, and waits for the rendered Play navigation. Readiness also requires the exact Electron PID to own `writer.lock` and the production integration socket to respond. An empty profile must render a usable empty state before creating anything. The script drives mapped features, captures evidence, then closes its own processes automatically. There is no seed shortcut in this journey.

To test the packaged Linux executable, build with `npm run package:linux`, then run:

```sh
DAILYXP_VERIFY_EXECUTABLE="$PWD/dist/linux-unpacked/dailyxp" node apps/desktop/scripts/verify.cjs run /tmp/dailyxp-packaged-review-UNIQUE
```

The source and packaged app use the same real user journey. An AppImage or archive being produced does not establish support on an untested distro.

## Doctor

During a running journey:

```sh
node apps/desktop/scripts/verify.cjs doctor RUN
```

Doctor reads the registered PID, validates its command line and the profile's writer-lock PID, then calls the production socket. It writes `doctor.json`. The journey also runs doctor internally after every launch. A stale PID, missing socket, wrong profile owner or command failure stops verification. Do not redirect to another application instance.

## Drive

The script uses Playwright's Electron driver. Real handles include `getByRole('button', {name: '+ Add', exact: true})`, `getByLabel('Name', {exact: true})`, `getByRole('button', {name: 'Save', exact: true})`, `getByRole('button', {name: 'Start Session', exact: true})`, `Pause Session`, `Resume Session`, `Finish Session`, and `Journey`.

Drive the UI through these controls, not renderer evaluation that invokes the preload directly. Native integration proof uses the production `dailyxpctl` protocol and a rendered production companion widget. The fixture's QtTest input performs a real right-click on that widget, then asserts the resulting paused state in Electron. The application is restarted and the active Session must replay before the journey continues. It also closes the real window, reopens it through the companion, observes disconnect/reconnect and captures earned XP feedback. Native backup dialogs use wtype on the owned private Wayland socket, with an isolated HOME. The GTK file dialogs float inside that compositor. No personal display fallback is allowed.

Read the feature files before extending the script. Run the separate [World edge journey](features/world.md) for the seven-day condition and private window lifecycle. Add focused journeys for uncovered acceptance criteria. Do not change expectations just to make a journey pass. Packaged mode must exercise the packaged controller before claiming a portable companion install.

## Evidence

`RUN` retains `instance.json`, `doctor.json`, `actions.jsonl`, Electron and companion logs, numbered PNG captures, `report.json` on success, and `cleanup.json`. `persisted-profile/desktop.json` contains the checksum envelope and canonical journal after teardown. Capture the user action, its visible result, and its persisted domain event. The companion's safe status response is separate evidence, not a replacement for rendered UI checks.

The default journey creates a commitment from empty state, starts/pauses/resumes a Session, drives the companion, restarts Electron, finishes the Session, completes its Task separately, completes a Habit, checks XP and Journey, creates a Routine, captures the approved Quest cartridge design and validates its local image and font, checks 699px width, long text, Escape/reopen, keyboard focus and reduced motion. It also creates a Goal and Milestone, completes the Milestone, creates a private Recovery track and check-in, verifies the privacy gate and status filtering, and provokes a real save failure. A finished Session Skill is corrected through the form. The actual native export dialog writes a backup, and a second empty Electron profile imports it through the native chooser. XP and the Goal must survive while source bytes remain unchanged. Inspect every supplied screenshot before handing it off.

The headless display deliberately has no personal session bus. Real notification delivery and full personal-shell installation require separate evidence. Imported personal state must never enter automated runs. No external service is mocked because these journeys exercise local behavior only.

## Cleanup

The `run` command closes its Electron handle and the exact Quickshell child it started, then stops its recorded Sway process group. It renames scratch state to `persisted-profile` so evidence survives. It does this after failed journeys too. Never kill by process name.

After a run, confirm:

```sh
test -f RUN/cleanup.json
test -f RUN/01-empty.png
test -f RUN/persisted-profile/desktop.json
```

If the driver itself is forcibly interrupted, inspect `instance.json`, `display.json` and the owned command lines before stopping those exact processes. Do not delete a socket or writer lock until its owner has exited. Never remove evidence as cleanup.

## Helpers

[verify.cjs](../../../scripts/verify.cjs) is executable. Its commands are `run RUN` and `doctor RUN`. [display.py](scripts/display.py) supplies private display isolation. [companion.qml](scripts/companion.qml) is verification scaffolding that hosts the production companion. It does not replace its service or controls.

Keep this feature map current with `/maintain-verification-skill` when application behavior changes.
