# Day blocks

Product behavior approved by Mohamed on 2026-10-22. Delivery design: semantic-event plan execution.

## Problem

One activity can consume the day and crowd out learning, building, business,
health and time outdoors. Ordered, timeboxed blocks reserve attention for each.

## Agreed behavior

- A day contains user-defined, ordered blocks, each with an overall duration.
- Each block contains ordered tasks with individual time targets.
- The user clicks Start block; there are no scheduled clock-time starts.
- All elapsed wall-clock time counts, including breaks and time away.
- Reaching a task target prompts the user to move to the next task. It does
  not automatically switch tasks; the block clock continues running.
- Reaching the block duration prompts the user to start the next block.
  The next block waits for an explicit click and gets its own full duration.
- Expiry does not mark unfinished tasks complete.

Example categories are Learning & creating, Building & business, and Life &
health. They are examples, not three hard-coded blocks or fixed durations.

## Delivery constraints

Keep block elapsed time separate from focused Session time and XP. Existing
Session pause/resume behavior must remain intact. Persist actual start times
and transitions; reopening or restarting must recover the elapsed block rather
than reset it or create duplicate transitions. Handle simultaneous task/block
expiry with the block transition taking priority.

The implementation must inspect the current planning/Session contracts and
coordinate its UI placement with the active redesign initiative (#107). This
approval does not authorize interrupting existing delivery or starting the
migration. Do not assume the old QML panel is the final frontend.

## Verification

Prove creation/order, explicit starts, task-target prompts, continuing block
time during breaks, block-end prompts, unfinished tasks, double-click safety,
restart and overdue recovery, and compatibility with existing focus tracking.
Use isolated real-app verification, relevant behavior/integration tests, lint
and rendered design review. Supply the short marked Before/During/After guide
and reversible prepared review state required by AGENTS.md. Manual PR review
and explicit merge authorization remain required.

## Delivery architecture

DayBlockModel owns one explicit plan execution in the existing journal. The plan is an ordered block list; each block has a duration and ordered task targets. Core supplies start timestamps and generated identities. Renderer commands carry expected plan ID, revision, run ID and task ID where relevant, so stale or repeated input cannot skip steps or overwrite another plan.

Plan order and targets freeze after the first start. Selecting a later first block deliberately leaves earlier blocks unstarted. Only the next ordered successor can start afterward. Next-block transitions record the previous end and new start in one atomic save. Final expiry waits for Finish plan. New day plan then creates a blank plan; it does not schedule or automatically copy yesterday's plan. The journal retains earlier execution history. There is no midnight reset.

Task advances are navigation records, not completion. Existing Tasks, Habits, focused Sessions and XP remain separate. Block elapsed time derives from actual UTC start instants. No background timer writes events. Block expiry takes priority over task expiry. A pending prompt appears on other app views without switching the user or stealing focus.

The architecture partner recommended this single-execution design over dated reusable templates because recurrence was not part of the approved scope. A second pass caught stale-plan revision reuse and backwards-clock writes; identity guards and preflight projection checks prevent those invalid transitions from reaching disk.
