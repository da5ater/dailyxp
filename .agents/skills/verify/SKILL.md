---
name: verify
description: Launch and drive DailyXP's real Quattro widget, panel, and state service in an private headless Wayland host; capture IPC, rendered UI, and persisted-state evidence for feature changes.
---

# DailyXP verification

Read [the feature index](features/README.md), then the relevant feature file. This driver tests the current checkout, not the installed plugin or PR #102. Never use unscoped `omarchy-shell` mutation commands against the user's shell.

## Launch

Run from the repository root. Requires `quickshell`, Python 3, Sway, and `/usr/share/omarchy/shell/{Commons,Ui}`. On Arch, `scripts/setup_headless.py` prepares a checksum-verified private Sway runtime in the user cache without installing system packages. The helper uses the local pacman database; refresh it through the normal system update process if package metadata is unavailable.

```sh
DRIVER=.agents/skills/verify/scripts/control.py
RUN=$(mktemp -u /tmp/dailyxp-verify-XXXXXXXX)
"$DRIVER" launch "$RUN"
```

The helper creates the directory exclusively, copies current application QML/JS, and launches a minimal Quattro host. Readiness requires a live owned PID and an available, settled, error-free production `sessionStatus` and fixture readiness observing StateStore.ready and recordingReady. The host supplies bar geometry and a service lookup; it does not replace DailyXP models, persistence, widget, panel, or IPC handlers. Commons and Ui come from the installed shell. It does not load the full shell's unrelated services. The host's disposable `XDG_STATE_HOME` protects personal progress. Each run owns a separate Sway compositor with a headless output, private Wayland socket and runtime directory, and software rendering. It never connects to the personal desktop or session bus. Opening the panel and injecting test input happen only inside that display, so Mohamed can continue using his applications. Never fall back to the personal display if headless startup fails.

Teardown is `"$DRIVER" cleanup "$RUN"`. Launch cleans up registered instances automatically after a failure. Run cleanup after failed drive or capture steps too. If launch fails before instance.json exists, no instance was registered; inspect the exception and directory. Never kill by process name.

## Doctor

```sh
"$DRIVER" doctor "$RUN"
```

This read-only application check verifies PID command-line ownership, the exact state-directory environment, fixture state-load readiness and production session status. It records its IPC request in the evidence log. If it fails, inspect `shell.log`; do not redirect commands to another instance. Sources are copied at launch, so relaunch after changing application files.

## Drive

```sh
"$DRIVER" call "$RUN" open
"$DRIVER" capture "$RUN" open
"$DRIVER" call "$RUN" uxCommand '{"type":"ux.navigate","surface":"Journey"}'
"$DRIVER" capture "$RUN" journey
"$DRIVER" call "$RUN" close
```

`call` invokes the real widget's production IPC handler on the exact owned PID. A `requested` response means asynchronous persistence started. Wait for doctor to report `saving:false`, then read the relevant status. If doctor is temporarily busy, retry after the save settles; never resend a mutation merely because its readback was early. `capture` saves status readbacks and a panel PNG rendered inside the private display. Use the mapped commands for feature-specific behavior.

IPC proof covers the command path only. For clicking and keyboard acceptance criteria, the fixture exposes `click NAME` and `key NAME Return|Space|Tab|Escape` using QtTest input against named production controls. `commitment_flow.py RUN` exercises linked goal/task persistence, repeated submission, keyboard removal, failed-write recovery, modal focus, and long-form scrolling. `session_flow.py RUN` exercises the real session rail, timer, pause/resume/finish, Tab focus, and hard-kill replay, then saves screenshots and persisted evidence. The optional launch `--seed` creates a disposable commitment through the production planning command; it is setup, not proof of task-entry behavior. Do not call internal QML setters or count Node model tests as panel interaction proof. Production Omarchy installation, multi-monitor coordination, and full-shell restart behavior require separate integration evidence; stopping this host cannot prove a full-shell restart criterion.

## Evidence

The run directory contains `instance.json`, tracked `source.diff`, `shell.log`, `actions.jsonl`, labeled status JSON and screenshots. `instance.json` records the checkout revision. Screenshots contain only the production panel on the private display. `display.json` records the owned compositor and socket; `display.log` records startup. Record which entry point was exercised and any omitted paths.

Verify the user action and resulting visible state, then the persisted side effect. `cleanup` copies state into `persisted-state/dailyxp/` before removing scratch state. Compare the captured projection with the saved envelope/journal, not only a successful response. The verification PATH refuses `omarchy-shell` and `notify-send` at the external desktop boundary, preventing reminder actions from controlling the personal shell or sending notifications. Reminder notification/action delivery is not verified by this host. There is no dry-run mode. Application model tests are supplementary:

```sh
omarchy plugin validate .
node --test tests/*.test.js
python -m unittest discover -s tests -p verify_driver_test.py
/usr/lib/qt6/bin/qmllint -I /usr/share/omarchy/shell BarWidget.qml Panel.qml StateStore.qml
```

Report import/lint failures accurately. Do not convert warnings into a clean result.

## Cleanup

```sh
"$DRIVER" cleanup "$RUN"
test -f "$RUN/cleanup.json"
test -f "$RUN/journey.png"
test -f "$RUN/persisted-state/dailyxp/state.json"
```

Cleanup checks PID ownership and stops the run's Quickshell host and private compositor process group. It removes the host and scratch state, retaining evidence and persisted state. Choose the screenshot label actually captured. Keep the evidence until the ticket is reviewed.

## Helpers

[control.py](scripts/control.py) is executable. Commands are `launch RUN`, `doctor RUN`, `call RUN METHOD [ARGUMENT...]`, `capture RUN LABEL`, and `cleanup RUN`. [host.qml](scripts/host.qml) is verification scaffolding, not a product entry point. Update both when the production host contract changes.

## Design review and UI stress checks

Follow the repository's pstack UI verification overrides. Read `emil-design-eng` for UI work and `review-animations` for changed motion. Review actual rendered states and record findings in a Before/After/Why table. Use `improve-animations` and `find-animation-opportunities` only when their audit scope applies.

Try to break the changed flow with rapid clicks and keyboard input, focus traversal and Escape, interrupted transitions, long/empty content, constrained dimensions, delayed saves and errors, reduced motion, and restart recovery where relevant. Assert the visible result and persisted state. Use disposable data on the private headless display. Add relevant regression cases; do not claim unexercised cases passed.

Headless verification does not refresh the personal installed plugin. Before a local UI handoff, follow AGENTS.md's refresh procedure and inspect the actual installed rendering. If rescan retains stale QML, restart the Omarchy shell and reopen the plugin after readiness.
