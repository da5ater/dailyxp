# V3 session evidence

The real BarWidget, Panel, PlayScreen and StateStore ran on a private Sway headless output at 1280×900. PNGs capture the actual panel at its rendered dimensions. QtTest generated pointer and keyboard events on production controls. No personal desktop input, screenshots, or state were used.

Run `.agents/skills/verify/scripts/session_flow.py /tmp/dailyxp-session-<unique>` from this checkout. The fixture creates a disposable task through the real planning command, then exercises keyboard START, live timer, SIGKILL/reopen, pointer Pause, frozen timer, Tab to Finish, Escape close/reopen, Space Resume and Return Finish. It also verifies duplicate launch/live restart refusals preserve the original instance. `report.json` records the result. This proves restart of the isolated production plugin host; full Omarchy shell integration remains a separate check.

The delayed-mkdir fixture reproduced an initial-load/save race. StateStore now starts file loading after directory creation and defers recovery until FileView callbacks finish. The full flow validates first-run persistence and running-session recovery.

165 Node tests and 4 Python verifier lifecycle tests passed. Scoped qmllint passed with installed qs imports and disabled `unqualified`, `missing-property`, and `signal-handler-parameters` categories. Default qmllint still reports inherited dynamic QObject access and missing Quickshell QProcess enum metadata; it is not a warning-free default lint result. No parse or unresolved-import warnings remain with the installed import tree.

The main agent simplified the changed code and inspected idle, running, paused and keyboard-focus renders for layout, contrast, state feedback and focus. No added motion is needed for these frequent controls. The design-improve helper's audit/critique/polish dependencies are unavailable locally, so those checks were performed directly. Independent standards/ticket review found and resolved failure cleanup and Escape handling defects, then reported no blocking findings.

Notifications and installed full-shell coordination are outside this isolated host's proof. External shell/notification commands are blocked. Merging requires Mohamed's manual review of current changes and explicit `merge`.
