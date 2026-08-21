# Reclaimed Kingdom model

STORY-001 maps Goals and Milestones to a coherent kingdom narrative without a resource economy. `StoryModel.js` is the pure seam: given planning/session/habit sources it derives provinces, landmarks, antagonists, momentum, and the three-day Comeback Quest.

## Provinces and landmarks

Each Goal becomes a Province: active→active, paused→sleeping, achieved→achieved (visitable), abandoned/archived→ruins. Each Milestone becomes a landmark: open→planned, completed→built. Derivation never mutates the source Goal/Milestone.

## Antagonists

Purely descriptive, neutral language, no insult: Drift (≥3 overdue), Distraction (≥2 discarded sessions), Doubt (active goal without progress), Apathy (Dormant momentum), Hollow King (7 inactive eligible days) occupying only unfinished provinces. Each antagonist explains its concrete cause.

## Comeback Quest

After 7 inactive eligible days a quest with three steps appears: small meaningful action, one planned session or routine, reduced daily target (30 min). The quest is available→active→completed/ignored; partial completion keeps it active and offers a smaller restart, never punishment or hidden loss. Achievements are cosmetic.

## Verification

```sh
node --test tests/*.test.js
```

Tests cover province/landmark mapping, inactivity detection, rest-day handling, quest success/partial/ignore without punishment, antagonist neutral copy, permanence, and deterministic replay.
