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
- Event creation resolves the named IANA zone through the runtime timezone
  database and derives wall time and UTC offset from the UTC instant. Supplied
  context must match those rules. Reload validates the frozen internal
  relationship without asking newer timezone rules to reinterpret history.
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

The manifest loads `StateStore.qml` once as the plugin service, rather than once
per monitor-mounted bar widget. At shell startup it first recovers the
newest checksum-valid primary/backup envelope, then validates or migrates the
embedded canonical journal. A fresh or legacy foundation envelope receives one
new device journal through the same backup-first atomic write sequence. If
both envelopes are damaged, or the embedded journal is invalid or unsupported,
startup stays available with an actionable error and does not write either
source file. The panel disables recording until a valid journal is ready.

The runtime uses the system IANA timezone and reads `dayBoundaryMinutes` from
the plugin entry in `shell.json`, defaulting to 240 (04:00). The value is
captured on each new event; changing it affects future events only.

## Verification

```sh
node --test tests/event_model.test.js
```

The suite covers deterministic ID generation, strict event validation,
idempotent append/replay, timezone and Day Boundary freezing, a DST offset
change, occurrence identity, canonical export/restore, bounded migration,
malformed state, and unsupported versions without network access.
