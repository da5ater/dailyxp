# Focused Session model

FOCUS-001 adds a local, event-sourced Session state machine. `SessionModel.js`
is its public behavior seam: explicit commands produce immutable `session.*`
event intents, and replay deterministically rebuilds selection, the one active
Session, finished Sessions, and auditable corrections. It never completes a
Task or awards XP.

## Selection and lifecycle

Selecting a Task records intent without starting elapsed time. One scheduled
reminder may become due as an actionable desktop notification: Start begins
the selected Task, Change Task opens the panel, and Dismiss records that
choice. Starting the selected Task satisfies it. A Session may instead be free,
may change its Task attachment and primary Skill, and may be planned or
open-ended. Only one Session can be active. Running
intervals start and end at persisted UTC instants, so pause, resume, shell
restart, and offline time cannot double count focused duration.

## Confirmation and competitive eligibility

Focused history and competitive eligibility remain separate:

- planned overtime requires an explicit include/exclude decision;
- inactivity stores only start/end instants, then asks whether that interval
  counts—never keys, screens, URLs, or content;
- at most 12 confirmed hours per DailyXP day are competitively eligible; and
- a cross-boundary Session belongs to the DailyXP day containing most focused
  time while retaining per-day competitive slices.

The runtime derives exact slices from the system timezone and configured Day
Boundary, then freezes that timezone and boundary on the Session. Corrections
intersect edited segments with an exact frozen UTC day timeline covering the
24-hour free-edit window, so travel, daylight-saving, or later settings cannot
rewrite historical competitive attribution or misplace a cross-boundary edit.

Finished Sessions can be corrected freely for 24 hours. Later changes are
stored as explicit adjustments. Any change to competitive duration requires
confirmation, and every correction retains its delta.

## Runtime controls

The bar shows live elapsed time. Right-click pauses or resumes without opening
the panel; left-click opens the compact Session controls. The controls use
immediate host-button feedback and avoid decorative motion because starting,
pausing, and resuming are frequent actions. The panel exposes Task selection,
planned/open-ended choice, free Session start, attachment changes,
pause/resume, finish, discard, reminder dismissal, finished-history navigation,
exact duration/Skill/planned correction, and reason-specific confirmation
choices. Planned overtime is never competitively credited while running; the
panel makes clear that the choice occurs before credit is awarded at Finish.

For deterministic inspection through Omarchy IPC:

```sh
omarchy-shell io.github.da5ater.dailyxp sessionStatus
omarchy-shell io.github.da5ater.dailyxp sessionCommand \
  '{"type":"session.start","session":{"id":"<uuid-v4>","taskId":null,"primarySkill":"general/focus","plannedMinutes":null,"startedAtUtc":"<utc>"}}'
```

## Verification

```sh
node --test tests/*.test.js
omarchy plugin validate .
/usr/lib/qt6/bin/qmllint -I /usr/share/omarchy/shell \
  BarWidget.qml Panel.qml StateStore.qml
```

Tests cover selection/reminder separation, state transitions, one active
Session, restart recovery, offline elapsed time, backward clock jumps, planned
overtime, inactivity, cross-boundary slicing, the daily cap, discard/change
attachment, and the 24-hour correction boundary.
