# Planning model

PLAN-001 adds a local, event-sourced planning domain behind the Omarchy UI.
`PlanningModel.js` is the public behavior seam. It accepts one explicit command,
returns immutable `planning.*` event intents, and deterministically rebuilds the
current projection from journal events. It never starts a Session or awards XP.

## Projection

The projection contains Goals, Milestones, standalone or linked Tasks, Routines,
dated Task Occurrences, and proposal decisions. Routine occurrences use
`routine:<encoded-id>:day:<frozen-dailyxp-date>` identity, so timezone, daylight
saving, or later Day Boundary changes cannot duplicate historical work.

Advancing a DailyXP day:

- generates a due occurrence once;
- respects weekday or interval schedules, start/end dates, and explicit rest
  dates;
- marks unfinished carryover occurrences overdue while still generating the
  new day's occurrence; and
- never edits completed history.

Routine edits support `today`, `today_and_future`, and `all_untouched` scopes.
Only open or overdue occurrences are editable. Milestone significance locks as
soon as progress is recorded. Unstarted records may be deleted; records with
durable history are archived.

## Consent and persistence

Template and adaptive proposal preview/edit commands return a preview without
events. Dismissal records only the dismissal interval. Commitments are created
only by explicit acceptance.

`PlanningJournal.js` converts accepted intents into the versioned EventModel
journal. `StateStore.qml` exposes `applyPlanningCommand(command)` and commits the
updated journal through the existing primary/backup envelope. The complete
planning projection is rebuilt after startup and every successful save.

## Verification

Run:

```sh
node --test tests/*.test.js
omarchy plugin validate .
qmllint -I /usr/share/omarchy/shell BarWidget.qml Panel.qml StateStore.qml
```

The tests cover hierarchy, standalone Tasks, recurrence idempotency, carryover,
rest dates, interval schedules, frozen occurrence identity, edit scopes,
completed-history preservation, lifecycle removal, Milestone measurement and
significance locking, proposal consent, journal persistence, and recovery.
