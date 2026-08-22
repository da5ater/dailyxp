# Recovery model

RECOV-001 provides private local Recovery Tracks. `RecoveryModel.js` is the pure seam: explicit commands produce `recovery.*` intents and replay deterministically rebuilds tracks, attempts, check-ins, milestones, and separate Recovery XP.

Tracks have normalized categories (pornography, smoking, alcohol, gambling, gaming, social_media) or moderated custom categories, a start date, visibility (private default), and a current attempt. Optional mood/trigger/note check-ins do not control the counter. Each completed day awards 20 Recovery XP; milestones at 1,3,7,14,30,60,90,180,365 days award progressively larger Lifetime XP and Achievements. Duplicate active tracks in the same category are rejected. Backdated start establishes personal history without retroactive competitive Season XP – Recovery XP is isolated.

An explicit `recovery.relapse` ends the attempt privately, preserves earned Lifetime XP and Achievements, removes the ended attempt from current-streak ranking, and offers `recovery.restart`. There is no failure sound or shaming. Deletion scopes are `attempt`, `track`, or `all`. Recovery has no streak freeze.

`StateStore.qml` exposes `recoveryProjection` via `RecoveryModel.project(journal.events)` and persists check-ins/relapses through the existing envelope.

## Executable surface

`recoveryProjection` is computed on every load/save (`StateStore.qml:155,552-553`) and now rendered:
- `Panel.qml` **Recovery** sheet — private Tracks (category + backdated startDate + optional custom label), ongoing/ended attempt status ("check-ins do not control the counter"), check-in (optional mood/trigger/note), explicit relapse ("ends the attempt privately — earned progress is kept and a restart is offered. No shaming."), restart (new attempt), and deletion scopes `attempt`/`track`/`all`. Private by default; optional Circle/global boards are future-gated (current local path stays private unless explicitly shared).
- `BarWidget.qml` / `StateStore.qml` IPC `recoveryCommand` / `recoveryStatus` for lifecycle verification; `applyRecoveryCommand` persists `recovery.*` via `EventModel` (handles multi-event `track.create` → track + first attempt).
