# Commitment form

## Sub-features

Linked Goal/Task persistence, goal reuse/preview, bounded chips, keyboard removal, scrolling, write-failure recovery, and modal session isolation.

## How to get to it (user POV)

Open Play and select NEW COMMITMENT. Name the task, choose or type an optional goal, set minutes, and save. Goal and summary chips support keyboard activation. The sheet scrolls when content grows; focus brings controls into view.

## Driving it with real input

Run `scripts/commitment_flow.py /tmp/dailyxp-form-<unique>`. It uses QtTest to type into production TextInputs and activate controls. It creates a new linked Goal/Task while a real session runs, repeats submission, tests reuse and removal, rejects malformed minutes, removes scratch-directory write permission to cause a real failure, retries after permission restoration, and adds twenty goals through real PlanningCommands for scrolling checks. Setup-only `seedGoal` is not proof of goal-entry behavior.

The retained report and panel PNGs record outcomes. Compare linked task and goal projections with persisted state; the modal must retain keyboard ownership and session state must remain running. SAVE must fit inside the scrolling viewport when focused.

## Gotchas

Permission changes affect only the disposable run directory and are restored in finally. Error-state screenshots use fixture capture directly because doctor intentionally rejects errored application state. Never disable doctor around ordinary mutations or redirect this run to the personal display.
