# JOURNEY progression

Run `scripts/journey_flow.py /tmp/dailyxp-journey-<unique>` from the repository root.

The isolated host uses the production StateStore, BarWidget, Panel, ShellContent and JourneyScreen. Navigate with the real controller keys and open the ledger with Return or Space. Read `journeyStatus` for the journal, progression and rendered award geometry. `ui` exposes named JOURNEY controls. `constrainPanel` changes only the private test viewport width.

`seedTimedSession` starts a backdated session through the production command, so the real Finish button can earn a minute-based award without waiting an hour. This is setup, not evidence of starting a session by input. The session driver independently verifies real START input.

Verify empty awards, session Finish followed by earned XP, level remainder, exact award amount/rule/timestamp, Escape, Tab traversal and visible focus. Kill only the owned host, reopen the same disposable saved state and compare totals and awards. Add long-reason correction awards through production progressionCommand to exercise a scrollable ledger and narrow viewport. Personal progress, desktop input and shell restart are outside this driver.
