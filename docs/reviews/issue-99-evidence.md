# Issue 99 verification

The delivery targets the Electron application merged in PR #110. The earlier QML ticket wording describes the retired full-plugin frontend. No QML changes are included, so qmllint and a QML rendered review do not apply to this diff. The Omarchy companion remains a compact integration client.

World renders the authoritative StoryModel projection, including Goal provinces, completed Milestone fill, real Momentum with its earned-activity window, and the seven-day Hollow King condition. Achieved provinces remain reclaimed. Recovery entry uses a footer confirmation dialog. Cancel has initial focus. Check-in, confirmed setback and restart persist real private events. A native window hide or minimize locks the view and clears unfinished private input even when the window reopens immediately.

Canonical event creation enforces `private:true` for every Recovery event. Append rejects unflagged new writes; normalization upgrades unflagged legacy events. Recovery intents also carry the flag. Ordinary progress, Insight, Share and companion status exclude Recovery details. A backup export intentionally includes private data and is labeled accordingly. Recovery does not alter ordinary XP.

## Reproduce

```sh
npm test
npm run lint
node apps/desktop/scripts/verify.cjs run /tmp/dailyxp-99-UNIQUE
node apps/desktop/scripts/verify-world.cjs /tmp/dailyxp-world-99-UNIQUE
node apps/desktop/scripts/verify-world.cjs /tmp/dailyxp-world-milestone-99-UNIQUE milestone
```

The main journey starts empty and drives actual controls through Task, Session, companion, Goal, Milestone, World, Recovery, Settings and native backup dialogs. The World edge journey uses only a disposable profile and production commands with a controlled clock to reach the seven-day prerequisite. It then drives real Electron controls on a private headless display. It does not substitute seeded state for the empty-entry journey.

Source evidence: `/tmp/dailyxp-99-electron-final`, `/tmp/dailyxp-99-world-final`. The model and Core suite covers private write sites, date boundaries, duplicate check-ins, repeated same-day restarts and replay. Both journeys retain screenshots, reports and cleanup records. Desktop input remains on the private display.

## Sequential improvement and rendered review

`simplify` separated Province label and card rendering from the page template and removed the obsolete inline privacy gate. The shared command completion now renders authoritative disabled states instead of enabling every button. The privacy state is a pending confirmation variant with an optional track ID; only the confirmed variant can record a setback.

The design pass checked the approved Quest cartridge palette and artwork, typography, empty content, 699px wrapping, native dialog focus, keyboard activation, press feedback and reduced motion. The external audit, critique and polish skill files referenced by design-improve are not installed; the checks were performed directly. No Figma reference applies. No motion was added; the static Province fill and immediate dialog transitions avoid delay and interruption races.

| Before | After | Why |
| --- | --- | --- |
| World displayed an offline competition placeholder | Real Goal provinces and earned activity cause | The scene explains personal progress. |
| Native progress elements used a green browser default | Amber fill and the existing muted track | Preserve the selected Quest palette. |
| An achieved Goal with no linked work showed 0/0 | An explicit reclaimed Goal message | Avoid contradicting its 100% fill. |
| Command completion enabled all buttons | Disabled state follows the saved projection | A daily check-in cannot be submitted twice. |
| Quick close/reopen could retain private fields | Native hide/minimize signal clears and locks them | Window lifecycle must preserve the entry guard. |

Motion review: approved. No new timers, layout animation, sounds or shame effects. Existing pointer press feedback is immediate, excludes visible keyboard focus, and respects reduced motion. No anchored popover was added. Native confirmation is centered and opens without animation.

The architecture pass keeps one core writer and one StoryModel projection. It adds no renderer-derived progress, competition subsystem, network service or new persistence store. Additional operating systems and distros remain outside this verification.

## Local review ownership

Local demo data must live in a separate issue-99 profile and be labeled REVIEW PROFILE. The normal profile and installed app are backed up before replacement. The guide gives click paths and real Before/During/After captures. Demo changes remain available until Mohamed finishes local review, then the owned cleanup archives them and restores the normal launcher. This PR remains draft until manual review; no auto-merge.

## Independent review fix

The reviewer reproduced a real integration error: Milestone XP did not mark its canonical date active, so a completed Milestone could leave Hollow King present and the earned-activity cause unchanged. ProgressionModel now records the resolved canonical date for that award and marks it active. A Core regression proves clearing and disk replay. A separate actual Electron journey completes the Milestone through Plan after seven inactive days (`/tmp/dailyxp-99-world-milestone-final`). The reviewer also identified two redundant fixture comments, which were removed. The full Node suite now has 207 passing tests.

## Native shutdown finding

The local refresh exposed a shutdown failure in the previous installed app: systemd stopped the whole process group, Chromium tried to restart terminated GPU children, then aborted with `GPU process isn't usable`. The coredump timestamps match the explicit stop commands. A private-display probe confirmed that the previous app already exits cleanly when SIGTERM targets only its main process. No application workaround is needed. The edge verifier now sends the real signal and asserts exit code 0. Owned local review units use `KillMode=mixed` so systemd signals the main process before forcing child termination. Personal canonical `desktop.json` and its backup match their pre-install hashes; Chromium caches changed during the refresh. No progress was lost.
