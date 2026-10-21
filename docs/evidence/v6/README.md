# V6 delivery evidence

The original seed-based delivery was incomplete. Habit creation and routine carryover were unreachable from product UI. Mohamed found this during installed-app review. Those historical captures and reports remain in this directory, but do not establish usable delivery.

The corrected application adds NEW HABIT on PLAY, including an empty-state entry. Its shared recurrence sheet saves a name and selected weekdays through HabitModel. SETUP exposes CARRY MISSED WORK for both new and existing routines. The existing-routine toggle preserves focus, displays saving state and shows write failures. Full habit editing remains deferred.

## Delivery from product entry

Run `python .agents/skills/verify/scripts/habit_flow.py /tmp/UNIQUE [smaller|skip|reschedule]`. It starts empty and creates habits and routines exclusively through actual QML controls. Its user-journey marker rejects engine mutation helpers across restarts. The gate also rejects pre-existing entities and domain history, using actual projection and journal readbacks.

Current application source is `6de2fe6`, whose UI matches `1a74ab9`; the later merge tightens only the verifier gate. `report-user-entry-smaller.json` comes from `/tmp/dailyxp98-delivery-final` and covers name/weekdays validation, cancel and focus return, 280-pixel layout, failed creation retaining input, retry, repeated Save without duplicate entities, tap completion, hold skip, failed completion writes, carryover creation and existing-routine setting, failed carryover writes, retained toggle focus, next-day overdue choice, smaller session and crash/replay. `report-user-entry-skip.json` and `report-user-entry-reschedule.json` prove those dispositions through the same UI entry path. `user-journey.json` records the gate. No model-command creation is used in these delivery runs.

The only synthetic lifecycle input is the private planning clock advancing one day. It does not change system time or personal progress. Failure tests temporarily deny writes only in the owned disposable state directory. Every flow cleans up its private host and compositor.

180 Node behavior tests and eight Python verifier tests pass. Plugin validation passes. Existing routine and session runtime regressions pass. The routine keyboard regression explicitly includes the new carryover Tab stop. Scoped qmllint exits successfully with inherited warnings; it is not warning-free. Frame-time profiling, physical touch devices, and assistive-technology readout were not tested.

## Rendered design review

| Before | After | Why |
| --- | --- | --- |
| No habit entry from empty PLAY | Visible HABITS card and NEW HABIT button | Make the feature reachable without seeded data |
| Habit checks require developer-created records | Name/weekdays sheet saves real habits | Let Mohamed create the prerequisite in the application |
| Carryover hard-coded off | Explicit setting for new and existing routines | Make overdue behavior reachable through supported UI |
| Toggle loses keyboard focus on replay | Restored focus after save, saving feedback and visible errors | Keep the setting understandable and operable |
| Verifier seeds prerequisites invisibly | Empty-state and IPC mutation gate | Reject the exact false-positive delivery path |

No animation was added. Habit checks and setting changes use immediate state feedback. Existing sheet, button and panel behavior stays in place. The repeated-key stress case can reopen a blank creation form after successful Save because focus returns to NEW HABIT. It never creates another entity without a new valid submission. Likewise extra Return presses after START SMALLER can pause or resume the newly focused session. Both behaviors are recorded rather than described as uninterrupted operation.

The grouped [click guide](../../reviews/pr-106.html) uses `699eb56`, the last installed version before this correction, for Before. New screenshots have distinct filenames. Earlier approved captures are retained. Yellow SVG markers scale with the actual app captures. The guide contains no application forms, simulator or browser bridge.

Detailed local evidence is under `/tmp/dailyxp98-delivery-final`, `/tmp/dailyxp98-ui-entry-skip`, `/tmp/dailyxp98-ui-entry-reschedule`, `/tmp/dailyxp98-ui-entry-regression-routine2`, `/tmp/dailyxp98-session-final`, and `/tmp/dailyxp98-existing-carryover-guide`. The independent reviewer uses separate `/tmp/dailyxp98-independent-*` runs. Application review is on PR106; the verifier repair is isolated in dependency PR108. Both require Mohamed's manual review and explicit merge authorization.
