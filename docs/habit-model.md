# Habit model

HABIT-001 adds a local, event-sourced habit domain. `HabitModel.js` is the public seam: explicit commands produce immutable `habit.*` event intents, and replay deterministically rebuilds habits, completions, freezes, streaks, and daily award summaries. It never awards XP directly; awards are derived for projection but remain local.

## Projection

The projection contains habits, completions, freezes, last advanced DailyXP date, derived streaks, and daily summaries. Habit eligibility uses `scheduledOn` with weekday, interval, or daily schedules, start/end dates, and explicit rest dates. Rest days are ineligible and do not break streaks. A streak increments only on completed eligible days, is preserved when a freeze is consumed explicitly for a missed eligible day, and resets only when an eligible day is missed without a freeze. Freeze consumption is explicit, idempotent, and cannot be used on rest or already-completed days. No permanent XP is removed when a streak breaks; longest is retained.

Daily summaries cap competitive contribution at seven habits per day (20 Season XP each) while additional completions remain personal Lifetime XP. Completing every eligible habit on a day awards exactly one 50 Lifetime XP full-set bonus. Daily summaries reconcile eligible, completed, competitive, and personal counts, and are frozen by DailyXP date via the EventModel 04:00 boundary context.

`HabitJournal.js` converts accepted intents into the versioned EventModel journal. `StateStore.qml` exposes `applyHabitCommand(command)` and commits through the existing primary/backup envelope. The habit projection rebuilds after startup and every successful save, and advances deterministically via `habit.day.advance`.

## Verification

```sh
node --test tests/*.test.js
omarchy plugin validate .
/usr/lib/qt6/bin/qmllint -I /usr/share/omarchy/shell \
  BarWidget.qml Panel.qml StateStore.qml
```

Tests cover schedule eligibility, rest-day handling, streak breaks, explicit freeze preservation, duplicate completion idempotency, day-boundary frozen dates, seven-per-day competitive cap, single full-set bonus, archiving vs deleting, and deterministic replay.
