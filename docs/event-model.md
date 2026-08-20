# DailyXP local event model

`EventModel.js` is the canonical V1 client event-journal contract. It is pure
JavaScript with no Qt, network, AWS, Rails, or filesystem dependency so the
same fixtures can run in Omarchy, backend tests, and a future desktop client.

## Identity and time

- Event and device IDs are RFC 4122 version-4 UUIDs. An event ID never changes
  after creation; append and replay treat a repeated ID as the same event.
- Every event records a canonical UTC instant and the wall-clock context seen
  by the user: local date/time, IANA timezone name, UTC offset, and configured
  Day Boundary.
- `dailyXpDate` is calculated once from that recorded context. Projection
  rebuild never asks the current clock, timezone database, DST offset, or
  current Day Boundary to reinterpret completed history.
- A Routine can assign `occurrenceKey(routineId, dailyXpDate)` when creating a
  Task Occurrence. Later events retain that key, allowing projections to count
  the occurrence once without regenerating its identity.

## Journal and projection

The journal has one schema version, its originating device ID, and an ordered
event array. `append` is immutable and idempotent by event ID. The neutral
projection deliberately contains only an applied-ID index, event counts by
type and frozen DailyXP date, unique occurrence keys, and the last applied UTC
instant. Feature tickets own their domain-specific projections and XP rules.

Canonical export sorts object keys recursively and ends with one newline, so
the same valid journal produces byte-identical offline exports. Import validates
every event and removes repeated event IDs without applying them twice.

## Migration and recovery

V1 accepts the current `schemaVersion: 1` journal and one bounded legacy shape,
`version: 0`, whose events already satisfy the event schema. A successful V0
migration returns the exact original bytes as `backupRaw` before returning the
new journal.

Malformed data, invalid events, and unknown versions return a recoverable error
with an actionable message and the exact `originalRaw` bytes. Callers must keep
those bytes and must not overwrite the source until a validated replacement is
durably written. There is no best-effort partial import.

## Verification

```sh
node --test tests/event_model.test.js
```

The suite covers deterministic ID generation, strict event validation,
idempotent append/replay, timezone and Day Boundary freezing, a DST offset
change, occurrence identity, canonical export/restore, bounded migration,
malformed state, and unsupported versions without network access.
