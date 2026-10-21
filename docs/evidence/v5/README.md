# Routine verification

The real private Quattro plugin host verifies SETUP → New routine → name/weekdays/duration → Save → PLAY. Routine creation emits both the Routine and today's Task Occurrence in one persisted planner command. PLAY starts a session referencing the occurrence ID, without fabricating a one-shot Task.

| Before | After | Why |
| --- | --- | --- |
| SETUP routines were fixture text and an inactive button | Real list, empty state and keyboard-accessible creation sheet | Recurrence becomes usable from the app |
| PLAY omitted dated occurrences | Today’s open occurrences appear with routine metadata and actual duration | Scheduled work appears automatically |
| Session references accepted only one-shot Tasks | The shared lookup resolves persisted Task Occurrences too | Routine focus retains its dated identity |
| A reload could conceal date-boundary generation errors | Restart the owned host with an injected next planning date and compare occurrence keys | The real startup path must generate once and replay deterministically |
| Long labels and wrapped metadata were hard to read | Bounded labels, full accessible names and increased line spacing | Narrow form and routine rows stay readable |

The production clock defaults to the real time. Only the private test host injects a next-day planningClock; the system clock and personal desktop remain untouched. The real startup ensureCurrentPlanningDay path generates the next occurrence, and another same-date restart produces no duplicates. This is production-plugin host restart evidence, not a full Omarchy shell restart.

The flow covers blank name, no weekdays, invalid minutes, Space/Return weekday input, rapid save without duplicate records, persisted occurrence identity, routine session START/Finish, same-day replay, next-day generation, 280-pixel form bounds, Tab/Shift+Tab/Escape, failed-write input retention and retry. Save restores focus to New routine; a later second Enter can open a fresh empty form, which the test distinguishes from a duplicate save.

173 Node behavior tests and four Python verifier tests pass. Existing session crash/recovery and commitment form stress regressions pass. Plugin validation and scoped qmllint pass. Scoped lint disables inherited dynamic QObject/Quickshell metadata categories and reports two inherited unused-import infos. Default lint warnings remain; this is not a warning-free default lint result. Runtime warnings in the test are the expected isolated DBus warnings and the deliberately induced write failure.

The main-agent simplify/deslop and rendered Emil passes kept the recurrence engine unchanged, centralized routine presentation, and reused ArcadeSheet’s scrolling/focus. No motion was added to keyboard actions, so timing/reduced-motion variants do not introduce new behavior. Independent review follows these passes. The installed plugin is not refreshed until Mohamed explicitly requests a local refresh.
