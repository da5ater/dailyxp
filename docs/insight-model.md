# Insight model

INSIGHT-001 explains personal activity without calendar planning. `InsightModel.js` derives period/skill/goal/task aggregates from sessions and habits, with application-name-only optional tracking (off by default, local, session-bound, rename/merge/exclude/delete). Recovery details never appear outside the Recovery entry; `isRecoveryExposed` always false.

Verification via aggregation/reconciliation, empty-state, and privacy tests.
