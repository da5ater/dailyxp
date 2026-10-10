# Planning-day lifecycle

DailyXP advances the current day and generates due occurrences without repeating the advancement.

## Sub-features

- DAY-ADVANCE: current day is reflected in planning status.
- DAY-IDEMPOTENT: repeating the request does not duplicate advancement.

## How to get to it (user POV)

Opening DailyXP loads the current day's work. The documented production IPC entry points are ensurePlanningDay and planningDayStatus. Task/routine creation controls depend on the checkout; this map does not claim the Phase R planning bindings are present.

## Driving it with production IPC

Preconditions: fresh host, doctor passed. Automatic startup advancement may already have run.

- Read before: `"$DRIVER" call "$RUN" planningDayStatus`; retain the JSON output in actions.jsonl.
- Advance: `"$DRIVER" call "$RUN" ensurePlanningDay`. Wait for doctor, then read planningDayStatus. Require available true, saving false, empty error and the expected local DailyXP date.
- Repeat: call ensurePlanningDay again and re-read planningDayStatus. Compare the saved journal before/after and require no duplicate day-advance events.

## Gotchas

The configured day boundary and system timezone determine the DailyXP date. `requested` is not a save acknowledgement. An empty day cannot prove routine occurrence generation; seed a routine through its real UI in a checkout that supports it before asserting that behavior.
