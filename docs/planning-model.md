# Planning model

`PlanningModel.js` is the canonical PLAN-001 planning contract: Goals and
Milestones, linked or standalone Tasks, Routines that generate dated
occurrences on each `day.advance`, carryover, and previewed proposals that only
commit on explicit acceptance. It is pure JavaScript with no Qt, network, or
filesystem dependency — the same tests run in Omarchy and in `node --test`.

## Identity and time

- Every planning entity uses a stable caller-supplied `id`. Occurrence identity
  is `routine:<encoded-routineId>:day:<dailyXpDate>` (dailyXpDate only).
  Duplicates are rejected; the projection rebuild is deterministic and
  idempotent by `occurrenceKey`.
- `dailyXpDate` is the frozen calendar string the event journal already records
  (`EventModel` + `StateModel` `dayBoundaryMinutes`). Planning never asks the
  current wall clock, timezone, or Day Boundary to reinterpret history. Changing
  a Routine's boundary/schedule affects future occurrences only.
- `scheduledOn(routine, dailyXpDate)` checks start/end window, explicit
  `restDates`, and the schedule (`weekdays [1..7]` or `interval {everyDays,
  anchorDate}`). Interval math is UTC-day arithmetic from `anchorDate`.

## Projection

The projection (`schemaVersion 1`) contains `goals`, `milestones`, `tasks`,
`routines`, `occurrences`, `proposals`, and `lastAdvancedDailyXpDate`. `decide`
returns frozen `planning.*` intents; `projectIntents` rebuilds the projection.

**Recurrence — exactly one per scheduled DailyXP date:**

- `day.advance` emits `occurrence.created` once per scheduled Routine per
  `dailyXpDate`, and never duplicates an existing `occurrenceKey`.
- `routine.create` after today is already advanced immediately emits today's
  occurrence when due.
- Startup catches up bounded (`MAX_CATCH_UP_DAYS=366`) by replaying
  `nextDate(lastAdvancedDailyXpDate)+1 .. dailyXpDate`, so work scheduled while
  the shell was stopped still appears.
- Rest dates, `endDate`, unscheduled weekdays/intervals produce no occurrence.

**Carryover — no duplicate completion, no missing new occurrence:**

- On `day.advance`, each open occurrence with `dailyXpDate < newDate` and
  `carryover:true` becomes `overdue` (`occurrence.overdue`), and the new date
  still receives its own `occurrence.created`. `carryover:false` leaves the
  prior occurrence `open`. In either case a new scheduled date is not skipped
  and prior completion is not duplicated.

**Edit scopes — completed history unchanged:**

- `routine.edit` supports `today`, `today_and_future`, `all_untouched` and only
  touches `open`/`overdue` occurrences. `today` mutates only that date's
  occurrence; `today_and_future` bumps `routine.revision` and updates future
  untouched occurrences; `all_untouched` updates every untouched occurrence.
- A schedule change removes a newly ineligible untouched occurrence or creates
  the now-eligible current occurrence; completed (`completed`/`skipped`/…)
  occurrences are never touched.
- `occurrence.transition rescheduled` creates a replacement key
  `rescheduled:<id>:day:<targetDate>`; `merged` requires `overdue` + today's
  open equivalent and records `mergedFrom`.
- Milestone `significance` and `measurement` lock once `milestone.progress` is
  recorded; a Milestone referenced by Tasks/Routines cannot move Goals.

**Lifecycle:** `entity.remove` deletes only unstarted records; anything with
durable history (`status !== open/active`, locked significance/progress, linked
tasks/occurrences) is archived.

## Consent — proposals change state only on explicit acceptance

- `proposal.preview` / `proposal.edit` validate and return `{preview, events:[]}`
  without mutating the projection. A dismissed adaptive proposal stays
  `suppressed` until `dismissedUntil`.
- `proposal.dismiss` records `{proposalId, dismissedUntil, missedOccurrenceIds}`
  and requires `dismissedUntil > dailyXpDate`.
- `proposal.accept` validates, expands `proposal.commands` through `decide`
  (rejecting nested proposals), and appends `proposal.accepted` — only then do
  Goals/Routines/occurrences get created.
- The adaptive heuristic: 3 unfinished occurrences of one Routine offer a
  `pending` adaptive proposal with a smaller `expectedMinutes` routine edit;
  repeated daily advances do not duplicate the pending proposal; only 3 *new*
  misses after accept/dismiss can offer another. The pre-dismiss/pre-accept
  `missedOccurrenceIds` snapshot is frozen at decision time.

Cross-repo fixture sharing (`da5ater/dailyxp-api` future) reuses the same
`PlanningModel.js` contract byte-for-byte — no recompute, no recompute drift.

## Persistence and recovery

`PlanningJournal.js` maps accepted intents → versioned `EventModel` journal
entries via `occurrenceKey`. `StateStore.qml` exposes
`applyPlanningCommand(command)` and commits through the backup-first atomic
envelope (`StateModel` `primary`/`backup` checksum-valid replay + frozen
DailyXP date). A fresh or legacy envelope receives one journal through the same
write sequence; torn envelopes recover the newest valid side.

## Verification

```sh
node --test tests/*.test.js
```

The suite covers deterministic occurrence identity, recurrence idempotency,
carryover without duplicate completion, rest/interval/eligibility,
Day-Boundary-immune frozen dates, bounded catch-up, scoped edits preserving
completed history, reschedule/merge, Milestone locking, lifecycle
delete-vs-archive, template/adaptive proposal preview/edit/dismiss/accept consent,
3-miss rescheduling (including carryover-disabled), duplicate-suppression, and
the cross-repo fixture contract.
