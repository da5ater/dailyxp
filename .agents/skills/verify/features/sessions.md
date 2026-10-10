# Focused sessions

A free session tracks focused work, pause/resume transitions, and completion.

## Sub-features

- SESSION-START: one active session begins.
- SESSION-PAUSE: paused time does not accumulate focus.
- SESSION-RESUME: focused time accumulates again.
- SESSION-FINISH: active session closes and retains its result.

## How to get to it (user POV)

Open Play, choose a commitment, and press START on TODAY FOCUS, then Pause/Resume and Finish. During a session, right-click the bar widget to pause/resume. Production IPC exposes `sessionCommand` and `sessionStatus`.

## Driving it with production IPC

Preconditions: fresh host, no active session, doctor passed. Use real current UTC timestamps; do not backdate transitions to manufacture duration.

- Start: generate a JSON sessionCommand with type `session.start` and session `{id:"verify-free",primarySkill:"backend/build",plannedMinutes:null,startedAtUtc:<current ISO UTC>}`. Require activeSession.id `verify-free` and status `running` in `sessionStatus` after save settles.
- Pause: send `{type:"session.pause",atUtc:<current ISO UTC>}` via sessionCommand. Require activeSession.status `paused`; capture visible timer and persisted transition.
- Resume: send `{type:"session.resume",atUtc:<current ISO UTC>}`. Require status `running`.
- Finish: send `{type:"session.finish",atUtc:<current ISO UTC>}`. Require activeSession null and the completed session in projection.sessions. Handle any production confirmation through the real confirmation flow; do not bypass it.

For each command use `"$DRIVER" call "$RUN" sessionCommand "$COMMAND_JSON"`, wait for doctor, and capture a descriptive label.

## Gotchas

Run `scripts/session_flow.py /tmp/dailyxp-session-<unique>` for real START/Pause/Resume/Finish controls through QtTest, keyboard and Tab focus, live/frozen timer assertions, and running-process SIGKILL/reopen replay. It creates a disposable commitment through the production planning command and retains evidence after cleanup. Command success alone cannot prove UI bindings or a ticking timer. Notification and inactivity behavior can occur during long runs. This minimal host cannot prove killing/restarting the full Omarchy shell. The automated flow records the killed PID and asserts the same session and segments after reopening, then compares completed focused time with persisted segment durations to detect double counting.
