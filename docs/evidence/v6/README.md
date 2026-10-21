# V6 habit and overdue evidence

Feature implementation is `fc8d673`, based on merged main `47dd353`. The installed production QML and JavaScript match `6042bcf` byte-for-byte, excluding the verifier host. No tagged release exists. `before-installed.png` renders that exact production revision with scheduled habits in disposable state. This task has not refreshed the personal installation.

`habit_flow.py /tmp/UNIQUE [smaller|skip|reschedule]` drives the real private widget, panel and StateStore. `report-habits.json` covers completion, long-press skip, repeated input, failed writes and restart retry, persisted reduced motion, next-day overdue work, smallest suggestion, Tab and Shift+Tab focus scrolling at 280 pixels, Start smaller and crash/replay. `report-skip.json` and `report-reschedule.json` cover the other dispositions. All test progress is disposable. Creation is seeded through engine commands because habit editing is outside #98.

178 Node tests, four Python verifier tests and plugin validation pass. Existing routine and session runtime flows pass. Scoped qmllint exits successfully but retains inherited unqualified accesses and dynamic component warnings. No warning-free claim is made. New quick-action component and bindings introduce no lint warning after bound component annotation.

| Before | After | Why |
| --- | --- | --- |
| Scheduled habits hidden on PLAY | Dated chips with checkmark, skip label and disabled terminal actions | Make completion and skips visible and durable |
| Keyboard focus below the viewport | Focused quick actions scroll into view | Keep controls reachable at narrow widths |
| No real overdue action | One shortest commitment and three explicit choices | Offer one manageable return without a backlog |
| Reduced-motion event rejected by journal | Lowercase event persists and replays | Honor the existing motion preference |

No new animation was added. High-frequency checks use immediate pressed color and saved state feedback. Existing modal and host transitions remain unchanged. Full Omarchy-shell restart, personal installation, physical touch hardware, assistive-technology readout, and frame-time profiling were not tested. The verifier uses QtTest pointer/keyboard input on a private Sway display. Habits and dispositions use existing backup-first envelope persistence. Start smaller's session is a separate transaction after its planning save; if session persistence fails, the smaller occurrence remains available on PLAY.

The short [illustrated click guide](../../reviews/pr-106.html) contains real captures and no application controls or bridge. Detailed runtime artifacts remain under `/tmp/dailyxp98-review-head`, `/tmp/dailyxp98-skip`, `/tmp/dailyxp98-reschedule`, `/tmp/dailyxp98-routine-regression`, and `/tmp/dailyxp98-session-regression` on this machine.

The rapid-Return stress case issues separate key presses after Start smaller moves focus to the session controls. Those presses can pause and resume the new session. The evidence therefore shows a paused linked session, not a claim that focus keeps running during key spamming. Only one overdue disposition and one session identity are created. This follows the existing session focus behavior.

The optional design-improve wrapper references audit, critique, polish and superpowers skills that are not available at its configured paths. Those nested wrappers were not run. The main agent performed the scoped rendered design pass using Emil, Apple, Gaming and Animate guidance and the repository verifier. No Figma reference exists. No new motion was justified for repeated habit checks. Independent review covers the resulting code and rendered states.
