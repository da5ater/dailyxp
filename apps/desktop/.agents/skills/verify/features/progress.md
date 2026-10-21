# Habits and Journey

## Sub-features

Habit creation and completion, undo, streaks, Lifetime XP, Level, Story Rank, Session history and XP Ledger.

## How to get to it (user POV)

On Play click + Habit, create a scheduled behavior, then Complete. Click Journey to inspect progress and its reason.

## Driving it with Playwright Electron

The default driver creates Stretch through + Habit and Save, clicks Complete, and asserts Undo appears. Verify positive Lifetime XP through the production status socket and inspect `habit.completed` in persisted state. Open Journey and assert XP Ledger appears with the awarded amount and reason. Restart and recheck the same totals when changing replay behavior.

## Gotchas

A very short Session may earn zero XP. A Habit supplies a deterministic award for the default journey. Completing a Habit twice must not multiply awards. Level and Story Rank come from the actual Progression model. Demonstration values in Paper are fictional and must never enter personal progress.
