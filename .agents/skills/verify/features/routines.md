# Routines and daily occurrences

Run `.agents/skills/verify/scripts/routine_flow.py /tmp/dailyxp-routines-<unique>` from the repository root.

The test enters SETUP through the real keyboard controller, opens New routine, validates blank name/no weekdays/invalid minutes, toggles weekdays with Space and Return, and saves. It checks that one Routine and today's occurrence are saved, with no one-shot Task generated. PLAY displays the routine label and actual duration. START references the occurrence ID and Finish succeeds.

Only the private host is killed and restarted. First restart uses the same date and preserves occurrence count. A subsequent restart injects the next day through StateStore's planningClock dependency; the normal startup ensureCurrentPlanningDay path generates that day's occurrence. A second restart on that date proves idempotency. The personal/system clock is never changed. This proves plugin-host startup across a planning date change, not a full Omarchy shell restart.

The flow also constrains the panel to 280 pixels, exercises Tab/Shift+Tab and Escape, checks control bounds and scroll-to-focus, and makes only the disposable state directory unwritable to verify retained input and successful retry. Screenshots, production planning projection, event journal and persisted state are retained under the run directory.
