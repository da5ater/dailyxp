# Planning and Routines

## Sub-features

Tasks, Goals, Milestones, Routine schedules, dated occurrences and gentle overdue choices.

## How to get to it (user POV)

Click Plan. Use + Task, + Routine or + Goal. Add a Milestone from its Goal. Today's Routine work appears on Play.

## Driving it with Playwright Electron

Click Plan, + Routine, fill Name, choose Scheduled days and Planned minutes, then Save. Assert its heading appears in Plan and its task button appears on Play when eligible today. The default journey does this from empty state. For edit changes, click the existing Routine's Edit button and assert today's untouched occurrence reflects the saved change. Verify `planning.routine.created` and `planning.occurrence.created` in the journal.

## Gotchas

A Monday-to-Friday Routine is not eligible on weekends. Do not make the journey pass by silently switching its schedule. Overdue choices require a prior dated occurrence and a later planning day. Prepare that precondition in a disposable profile and keep the actual disposition interaction on the user controls.
