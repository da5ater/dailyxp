# V2 Commitment Sheet binds `task.create` — no new engine noun

> In the context of the Phase R V2 slice (#94) needing a user-facing "commitment" concept while PlanningModel's frozen engine has only Goal/Milestone/Task/Routine nouns, I decided to bind the Commitment Sheet directly to `task.create` (standalone, urgency "normal", primarySkill "general/focus", estimateMinutes = daily duration) rather than inventing a commitment entity or misusing Goal/Routine, accepting that "commitment" is a presentation-layer word for a one-shot Task until V5 introduces routines for recurring commitments.

## Context

The shaping breadboard defines P5 "Commitment Sheet" as name + duration → Save → today-rail. CONTEXT.md defines the domain vocabulary; "commitment" appears there only inside "Planning Proposal". The engine (E1, frozen per shaping correction 2026-08-24) validates strictly: tasks need id/title/estimateMinutes≥1/urgency/primarySkill; routines additionally need schedule/startDate/restDates. A first-run commitment ("Ruby study, 2h/day") is conceptually recurring — but recurring *generation* belongs to V5 (Routine seeds the day), and #94's out-of-scope section explicitly defers routines.

## Options Considered

| Option | Pros | Cons |
|--------|------|------|
| Bind to `task.create` standalone | Zero engine changes; exact AC fit (name+duration→rail→replay); sessions already attach to tasks (V3 ready) | "Daily" in the sheet copy slightly over-promises recurrence until V5 |
| Invent a `commitment` entity + command | Conceptually honest | Touches the frozen E1; kill criterion triggers (engine gaps → stop and reassess); schema migration burden |
| Bind to `routine.create` with weekdays=[today..7] | Gives real recurrence immediately | V5 scope leak into V2; routine needs startDate/schedule plumbing the sheet shouldn't own yet; occurrences only exist after day.advance |

## Decision

Chosen: **bind to `task.create`**, because the vertical contract (#94) requires exactly what task.create provides — a named, durated work item visible on the rail from planningProjection, surviving replay. The sheet labels it a commitment (presentation vocabulary); the journal stores an immutable planning.task.created event. When V5 lands Routine creation, recurring commitments graduate naturally; existing one-shot tasks remain valid standalone Tasks.

Sheet defaults: `urgency: "normal"`, `primarySkill: "general/focus"` (Skill taxonomy UI arrives later; a stable placeholder keeps the engine validation green), `id: EventModel.uuidV4()`, `goalId: null`, `milestoneId: null`.

## Consequences

- No engine edits; V2 risk stays Low-Medium as planned.
- Today-rail renders `planningProjection.tasks[0]` (newest-last order); multiple commitments list without management UX per #94 out-of-scope.
- The empty-state card hides once ≥1 task exists (`hasAnyCommitments` reads the real projection when bound).
- If a future slice wants true daily recurrence before V5, it files its own decision record — this AgDR does not pre-decide it.

## Artifacts

- Branch `feature/GH-94-first-commitment` (PR pending at time of writing)
- da5ater/dailyxp#94 · shaping P5 · slices.md V2 row
