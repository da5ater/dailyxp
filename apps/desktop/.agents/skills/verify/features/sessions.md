# Daily work and Sessions

## Sub-features

Commitment entry, explicit selection, start, pause, resume, finish, separate Task completion, free Sessions and restart replay.

## How to get to it (user POV)

Open DailyXP. Play is the initial view. Click + Add to create a commitment. Click the commitment to select it. Click Start Session.

## Driving it with Playwright Electron

The default driver starts from an empty profile, fills Name and Planned minutes, clicks Save, selects the visible commitment, then clicks Start Session. Assert Pause Session becomes visible and the protocol reports `running`. Right-click the rendered companion and assert Resume Session appears. Resume through Electron, restart the process, and assert the running Session survives. Finish, then click Done on the Task and assert it leaves the open list. Inspect `session.started`, `session.paused`, `session.resumed` and `session.finished` in the persisted journal.

## Gotchas

A Session does not complete its Task. Planned overtime may require an explicit scoring choice. A restart with an active Session should not show Start Session. The wall clock is real. Do not insert a finished Session through a test-only endpoint to prove this flow. Destructive discard opens a native confirmation.
