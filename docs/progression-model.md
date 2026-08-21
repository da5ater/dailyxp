# Progression model

PROG-001 adds a local, rule-versioned progression domain. `ProgressionModel.js` is the pure seam: given the journal events, it deterministically derives an idempotent XP ledger, Levels, Story Ranks, Momentum, and season-ready standardized scores. It never contacts a server and never mutates earned history.

## Ledger

Every qualifying source event produces one ledger entry with `ruleVersion: 1`, a stable `id` derived from the source `eventId`, a human-readable `reason`, `lifetimeXp`/`seasonXp`, and a previewable `calculation`. Duplicate source events are idempotent. Corrections are explicit `progression.correction` entries.

- Focused minute = 1 Lifetime XP, floored per session; planned session +20% (floor), daily-target +25% when ≥120 min.
- Habit = 20 Lifetime XP each; Season capped at 7 per day, extras remain personal; full-set = 50 Lifetime XP once per day.
- Milestone = 250/500/1000/2000/4000/6000 Lifetime XP for significance 1–6 (locked at first progress); Season 0 so arbitrary significance cannot farm Season XP.

Lifetime XP never decreases except via an explicit correction entry that remains auditable.

## Level and Story Rank

`levelForXp` consumes `500 + 50*(level-1)` per level, unbounded. `storyRankForLevel` maps Wanderer 1, Settler 5, Builder 12, Steward 20, Warden 35, Vanguard 50, Champion 75, Regent 100, Sovereign 150.

## Momentum

Derived from distinct dailyXpDates with any ledger entry in the last 7 calendar days: 0–1 Dormant, 2 Stirring, 3–4 Steady, 5–6 Blazing, 7 Legendary. Rest days are treated as ineligible and do not hurt momentum by exclusion from the 7-day window. Permanent XP, Levels, Ranks, and completed work remain unchanged when momentum moves.

## Season

`progression.season.reset` clears current Season XP while preserving Lifetime XP and ledger history. Habit cap is re-evaluated only within the active season.

`ProgressionJournal.js` persists explicit correction/season-reset intents; `StateStore.qml` exposes `applyProgressionCommand` and recomputes `progressionProjection` via `ProgressionModel.project(journal.events)`.

## Verification

```sh
node --test tests/*.test.js
```

Tests are table-driven for awards, cap, rounding (floor), idempotency, correction, milestone significance locking, Level thresholds, Story Rank thresholds, Momentum permanence, season reset, and deterministic replay.
