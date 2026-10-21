# Habits and a gentle way back

Run `python .agents/skills/verify/scripts/habit_flow.py /tmp/dailyxp-habits-UNIQUE` from this checkout. It creates scheduled habits and carryover routines only in disposable state through real model commands. Habit creation is setup, not proof of a habit editor.

The flow drives actual PLAY controls with pointer, hold, Return, Space, Tab, Shift+Tab and Escape. It checks repeated completion, durable skip, failed-write recovery, reduced motion, next-day carryover, the shortest single suggestion, visible narrow focus, Start smaller and owned-host crash/replay. Use a fresh directory and a final `skip` or `reschedule` argument for the other dispositions. Each run cleans up its host and retains PNGs, journal state and `report-habits.json`.

Habit creation/editing is outside this ticket. START SMALLER creates a five-minute maximum occurrence and starts its linked session after the planning save. TOMORROW reschedules the selected occurrence for the next DailyXP day. SKIP resolves it. Each action clears the suggestion for the rest of that DailyXP day. Other overdue work stays unchanged. A later day can offer one suggestion again.
