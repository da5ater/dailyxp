# Habit model

`HabitModel.js` is the canonical HABIT-001 habit contract: scheduled Habits,
completions, optional freezes, per-Habit streaks, and daily award summaries. It
is pure JavaScript with no Qt, network, or filesystem dependency — the same
tests run in Omarchy and in `node --test`. It never awards XP directly; awards
are derived for projection and remain local.

## Identity and time

- Every Habit uses a stable caller-supplied `id`. Completion and freeze identity
  is `habitId::dailyXpDate`; duplicates are rejected and replay is deterministic
  and idempotent.
- `dailyXpDate` is the frozen calendar string the event journal already records
  (`EventModel` + `StateModel` 04:00 boundary). Habit logic never asks the wall
  clock or reinterprets history; `habit.day.advance` only moves
  `lastAdvancedDailyXpDate` forward.
- `scheduledOn(habit, dailyXpDate)` checks archived status, the start/end
  window, explicit `restDates`, and the schedule (`weekdays [1..7]`, `interval
  {everyDays, anchorDate}`, or `daily`). Interval math is UTC-day arithmetic
  from `anchorDate`.

## Projection

The projection (`schemaVersion 1`) contains `habits`, `completions`, `freezes`,
`lastAdvancedDailyXpDate`, `streaks`, and `dailySummaries`. `decide` returns
frozen `habit.*` intents; `projectIntents` rebuilds the projection.

**Streaks — increment, preserve, reset, retain:**

- A streak increments only on a completed eligible day. The current eligible
  day (not yet completed) does not break the streak until it is passed.
- A missed eligible Habit breaks only its own streak; other Habits' streaks are
  independent.
- An explicit freeze preserves the streak for a missed eligible day. A streak
  resets only when an eligible day is missed with no freeze.
- Rest days are ineligible and never break a streak.
- Breaking a streak removes no permanent XP; `longest` is always retained.

**Freeze — explicit, idempotent, restricted:**

- `habit.freeze.consume` is explicit; consuming it twice for the same day emits
  no new event.
- A freeze cannot be consumed on a rest day or on an already-completed day.

**Daily awards — cap, full-set bonus, visibility:**

- Competitive contribution is capped at seven Habits per day (20 Season XP
  each); completions beyond seven remain personal Lifetime XP and stay visible.
- Completing every eligible Habit on a day awards exactly one 50 Lifetime XP
  full-set bonus (`isFullSet`), once per day regardless of duplicate events.
- Daily summaries reconcile eligible, completed, competitive, and personal
  counts and are frozen by `dailyXpDate`.

## Persistence and recovery

`HabitJournal.js` maps accepted intents into the versioned `EventModel` journal.
`StateStore.qml` exposes `applyHabitCommand(command)` and commits through the
backup-first atomic envelope (`StateModel` `primary`/`backup` checksum-valid
replay + frozen DailyXP date). The habit projection rebuilds after startup and
every successful save, and advances deterministically via `habit.day.advance`.

## Verification

```sh
node --test tests/*.test.js
omarchy plugin validate .
/usr/lib/qt6/bin/qmllint -I /usr/share/omarchy/shell \
  BarWidget.qml Panel.qml StateStore.qml
```

The suite covers schedule eligibility, rest-day handling, streak breaks,
explicit freeze preservation, duplicate completion idempotency, day-boundary
frozen dates, seven-per-day competitive cap, single full-set bonus, archiving
vs deleting, and deterministic replay.
