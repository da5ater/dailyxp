# Issue 113 delivery evidence

Day blocks is a separate wall-clock plan beside Play. Users define ordered blocks and task targets. Start and every task/block transition require an explicit action. All elapsed time counts; focused Sessions, planning Task completion and XP remain independent.

## Architecture and review

The requested architect partner compared a single explicit execution with reusable dated plans. We chose the explicit execution to avoid adding recurrence or completion behavior. The first Start may select any block; visible copy explains that earlier blocks remain unstarted. Subsequent starts follow the order. Editing freezes after the first start. Final expiry waits for Finish plan; New day plan creates a blank plan. Midnight changes nothing automatically.

DayBlockModel owns semantic plan/start/advance/end/finish events and a pure time-derived view. No timer writes events. Core supplies UTC and IDs. Expected plan ID plus revision reject stale edits/starts; expected run/task IDs reject repeated transitions. Next block appends previous-end plus next-start atomically. Candidate projections validate before atomic storage and become live only after a successful write.

The architect caught a stale-plan revision ABA and a backwards-clock transition that could fail replay after commit. Both were fixed and tested. Independent review approved code through `2c9975d`; it found a 240-character unbroken name overflowing the active view at desktop width. Wrapping now applies at every width, verified independently at 1276px and 620px. No blocking findings remain.

## Verification

- `npm test`: 224 passed, none skipped. Ten new tests cover exact one-millisecond deadlines, simultaneous task/block expiry, overdue next-block fresh time, duplicate commands, stale plan identities/revisions, restart and midnight, focused Session isolation, no Task completion/XP, export replay, malformed import and failed/backwards-clock writes.
- `npm run lint`: clean, no warnings. `git diff --check`: clean. Eight Python verifier-driver tests passed.
- Real source journey: `/tmp/dailyxp113-source-1`; independent source journey: `/tmp/dailyxp113-review`. Both start from empty disposable progress and drive actual controls on private Wayland.
- Final packaged journey: `/tmp/dailyxp113-packaged-reviewed`, production revision `2c9975d`. It waits real two-minute plus one-minute block durations; this is configured product time, not a performance measurement. It creates/reorders/removes targets and blocks, tests empty input, long text, narrow layout, actual failed save with preserved draft, keyboard focus/Enter/Escape/reopen, restart, reduced motion, task prompt from Play, explicit advancement, deadline priority, duplicate next clicks, fresh next start, explicit finish/new plan and long active names at both widths. A separately paused focused Session remains unchanged. XP remains zero.
- Existing full Electron/companion regression: `/tmp/dailyxp113-regression-final`. Sessions, hard-kill replay, companion controls, Task/Habit XP, Routine, Journey, World, private Recovery, settings, native backup import/export and reset passed. Its first attempt failed because the native chooser wrote `canonical-export.json.json`; the fixture now records and validates the actual destination while preserving checksum/journal/replay assertions. The rerun passed.
- All private runs retain actions, real PNGs, reports, persisted profiles and cleanup records. Source and final packaged captures were inspected. No personal profile was used for automated tests.

## Sequential design and improvement

The main agent ran simplify, deslop/comment and focused design checks before independent review. The model exposes project/decide/viewAt; renderer helpers stay in day-blocks.js and Core retains command ownership. No background scheduler, Session wrapper or notification queue was added. Broader refactoring is outside this ticket.

| Before                                          | After                                                          | Why                                                   |
| ----------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| No ordered elapsed-time plan                    | Day blocks beside Play                                         | Cover the whole day independently of focused work.    |
| Timer target visible only on its own surface    | Pending banner across ordinary views                           | Reveal the prompt without moving focus automatically. |
| Long unbroken active names overflowed           | Wrapping at every width                                        | Keep controls and results reachable.                  |
| Programmatic heading focus used control outline | Heading destination with actual controls retaining amber focus | Preserve navigation context without a giant outline.  |

Emil, gaming-entertainment, Apple and animate principles were applied to the existing framework. Controls respond immediately, focus remains visible, frequent keyboard actions have no added motion, and clock digits do not animate layout. No popover or transition was introduced. Review-animations approves the changed flow. System and saved reduced-motion handling remain active. The audit/critique/polish dependencies referenced by design-improve are absent; their focused accessibility, hierarchy, responsive and feedback checks were performed in the main agent and reviewed independently. Those missing skills were not claimed as executed.

## Installed local review

Last installed baseline: merged main `1d7e0eb`, production `50071ca`. Actual empty baseline Play/Plan pictures are retained at `/tmp/dailyxp113-baseline`; its private processes stopped. The guide uses these real Before captures and current packaged During/After captures.

Current production revision `2c9975d` is installed at `~/.local/opt/dailyxp`. All 43 source and asset files match checkout; packaged name/version/main also match. Installer retained the previous application directory. Installed companion and personal canonical files were separately backed up. Personal desktop.json and desktop.backup.json hashes remain unchanged. The real installed Day blocks page was reopened and inspected, with REVIEW PROFILE · DEMO DATA visible; native and renderer captures are retained. No shell reload was needed: companion QML is unchanged, and the app restarted into the installed renderer.

Owned profile: `~/.local/state/dailyxp-review-113`. It contains only a draft two-minute Learn and create block with Read one page / Sketch an idea targets (one minute each), followed by a one-minute taskless Life and health block. These names are review examples, not built-in categories. Both blocks await Start. IDs: review-113-learn, review-113-read, review-113-sketch, review-113-life. Personal progress was not copied into the review profile.

`~/.local/state/dailyxp-handoff-113` records ownership, launcher hashes, previous symlinks, personal/plugin backups, installation checks and actual visible captures. `dailyxp-review-113.service` owns the review app; dailyxp and dailyxpctl route to that profile so the companion follows it. Cleanup script `cleanup-review.py` is syntax checked and waits for review completion. It verifies ownership, stops only the owned writer, archives the entire review profile including user edits, restores normal launcher symlinks and starts the normal profile. It never restores an old personal snapshot or deletes personal progress. Review data remains available while Mohamed tests.

## Limits

Linux unpacked Electron is tested. AppImage/FUSE, other distributions, ARM64 and desktop notification delivery are unverified. No QML source changed, so QML lint and the legacy root QML application journey were not rerun; the production Electron/companion journey covers the active application. There is no calendar recurrence, automatic Task completion or automatic block start. Draft PR requires Mohamed's manual review of its current changes and explicit merge authorization.
