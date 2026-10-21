# Issue 107 delivery evidence

Implementation revision is 1fc4eb26e894d8115194f3195557191f78ad8cb2. App runtime sources are unchanged since the independently approved fixes; the last commit orders a verifier read after visible completion.

## Verified

- 197 Node behavior and integration tests pass. Eight Python verifier tests pass.
- JavaScript lint, shell syntax, desktop launcher validation and Omarchy companion manifest validation pass.
- The final journey runs the extracted archive's installed launcher and installed controller, not source Electron. Its instance, report, actions and cleanup records are included here.
- Empty-state commitment entry, selection, Session start/pause/resume/finish, separate Task completion, hard-kill replay and exact writer ownership pass.
- The real companion widget reopens a hidden window, pauses through a real right-click, clears disconnected status, reconnects without old celebrations and renders new earned XP feedback.
- Habit creation/completion, explainable Journey, Routine creation, Goal/Milestone completion with a 250 XP award, private Recovery creation/check-in/gate reset and status privacy pass.
- Keyboard Enter/Space/Tab/Shift+Tab focus, 699px width, long form text, Escape/reopen, reduced motion, actual read-only-profile save failure and no phantom Task pass.
- Session correction preserves exact focused time. Independent regression verifies excluded inactivity stays excluded after editing a Skill and replaying disk state. Completed Milestone associations survive commitment edits.
- Native export writes a real backup through GTK. A separate empty Electron app imports it through GTK, preserves XP and its Goal, and leaves source bytes unchanged.
- Local app and companion were installed, the shell restarted, and the actual rendered app and bar inspected. All 39 packaged production source files match the intended revision. The old plugin and personal state are backed up. Personal source hashes remain unchanged.

## Measurements and limits

One warm instrumented launch reached rendered navigation and the owned core in approximately 0.3 seconds; exact samples are in actions.jsonl. The software-rendered Electron process tree used 296.6 MiB proportional memory. No CPU ticks were observed in a 3.009-second stable-process sample. This short sample is limited by kernel tick resolution and does not establish zero CPU use. It includes Playwright debugging overhead and excludes the companion process. It is not a cold-start benchmark, cross-distro result or speedup claim.

AppImage and tar.gz builds succeeded. The extracted archive install and full real-app journey ran on this Omarchy x86-64 machine. AppImage FUSE execution, ARM64 and additional distros remain unverified. The app bundles Electron and uses ordinary Linux libraries plus util-linux flock; Quickshell is needed only by the Omarchy adapter.

The isolated compositor has no personal notification bus. Safe XP feedback in the actual companion is verified. OS notification delivery remains unverified and opt-in notifications default off.

qmllint reports QProcess::ExitStatus metadata and dynamic bar.shell properties, plus unused-import information. There are no syntax failures; the actual companion executes in both the isolated and personal shell. Full output is in qmllint.log. JavaScript lint is clean.

npm audit reports eight moderate transitive/build-tool findings through electron-builder's sprintf-js chain. They are not bundled application dependencies; the app has no npm runtime dependencies. No high or critical finding was reported. This is recorded rather than silently downgrading the selected builder.

Paper's weekly MCP quota interrupted the third new game artboard. The adventure and memory-card concepts are editable in Paper; all three completed visual directions are in the local HTML comparison. Mohamed chose Quest cartridge after the quota limitation was disclosed. The third editable Paper board remains a design-artifact limitation, so issue 107 stays open rather than claiming every original checkbox complete.

## Local review

The running application clearly labels REVIEW PROFILE / DEMO DATA. It has a selected 45-minute commitment, a Routine, Habits, a Goal, completed Milestone, Session history, XP and a private demonstration track. The normal desktop profile separately contains a validated copy of the real legacy journal and preserved earned XP. It is closed during demo review.

Local-only backup and cleanup ownership is recorded under ~/.local/state/dailyxp-handoff-107. Temporary launchers route the app and companion to ~/.local/state/dailyxp-review-107 during review. Keep that review state while Mohamed is testing. On his instruction to finish local testing, run the owned cleanup helper, which stops only the review unit, archives demo changes without deletion, restores normal launchers and opens the migrated normal profile. Do not reset or overwrite either profile.

The illustrated guide is in docs/reviews/issue-107.html. PR approval and explicit merge authorization remain Mohamed's decision.
