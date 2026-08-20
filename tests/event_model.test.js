const test = require("node:test");
const assert = require("node:assert/strict");

const EventModel = require("../EventModel.js");

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";

function event(overrides = {}) {
  return EventModel.createEvent({
    eventId: EVENT_ID,
    deviceId: DEVICE_ID,
    type: "foundation.probed",
    occurredAtUtc: "2026-08-20T01:30:00.000Z",
    localDateTime: "2026-08-20T03:30:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 120,
    dayBoundaryMinutes: 240,
    occurrenceKey: EventModel.occurrenceKey("routine/anki", "2026-08-19"),
    payload: { probeId: "probe-1" },
    ...overrides
  });
}

test("generates RFC 4122 version-4 IDs from an injectable source", () => {
  const id = EventModel.uuidV4(() => 0);

  assert.equal(id, "00000000-0000-4000-8000-000000000000");
  assert.equal(EventModel.isUuidV4(id), true);
});

test("freezes UTC, timezone, offset, local time, and DailyXP date on an event", () => {
  const created = event();

  assert.equal(created.schemaVersion, 1);
  assert.equal(created.dailyXpDate, "2026-08-19");
  assert.equal(created.context.timezone, "Africa/Cairo");
  assert.equal(created.context.utcOffsetMinutes, 120);
  assert.equal(created.context.dayBoundaryMinutes, 240);
  assert.equal(Object.isFrozen(created), true);
});

test("computes the DailyXP date without consulting the current timezone", () => {
  assert.equal(EventModel.dailyXpDate("2026-08-20T03:59:59.999", 240), "2026-08-19");
  assert.equal(EventModel.dailyXpDate("2026-08-20T04:00:00.000", 240), "2026-08-20");
  assert.equal(EventModel.dailyXpDate("2026-03-27T03:30:00.000", 240), "2026-03-26");
});

test("rejects invalid context before it enters the journal", () => {
  assert.throws(() => event({ occurredAtUtc: "yesterday" }), /occurredAtUtc/);
  assert.throws(() => event({ timezone: "" }), /timezone/);
  assert.throws(() => event({ dayBoundaryMinutes: 1440 }), /dayBoundaryMinutes/);
  assert.throws(() => event({ payload: { bad: undefined } }), /payload/);
});

test("append is immutable and idempotent by stable event ID", () => {
  const empty = EventModel.createJournal(DEVICE_ID);
  const once = EventModel.append(empty, event());
  const twice = EventModel.append(once, event());

  assert.equal(empty.events.length, 0);
  assert.equal(once.events.length, 1);
  assert.equal(twice, once);
});

test("projection rebuild is deterministic and ignores duplicate IDs", () => {
  const first = event();
  const second = event({
    eventId: "33333333-3333-4333-8333-333333333333",
    type: "session.finished",
    occurredAtUtc: "2026-08-20T06:00:00.000Z",
    localDateTime: "2026-08-20T08:00:00.000"
  });
  const journal = { schemaVersion: 1, deviceId: DEVICE_ID, events: [first, first, second] };

  const firstBuild = EventModel.rebuildProjection(journal);
  const secondBuild = EventModel.rebuildProjection(journal);
  assert.deepEqual(firstBuild, secondBuild);
  assert.deepEqual(firstBuild.appliedEventIds, [EVENT_ID, second.eventId]);
  assert.deepEqual(firstBuild.countsByType, { "foundation.probed": 1, "session.finished": 1 });
  assert.deepEqual(firstBuild.countsByDailyXpDate, { "2026-08-19": 1, "2026-08-20": 1 });
  assert.deepEqual(firstBuild.uniqueOccurrenceKeys, [first.occurrenceKey]);
});

test("DST and current Day Boundary changes cannot move frozen history", () => {
  const beforeDst = event();
  const afterDst = event({
    eventId: "44444444-4444-4444-8444-444444444444",
    occurredAtUtc: "2026-08-20T01:30:00.000Z",
    localDateTime: "2026-08-20T04:30:00.000",
    utcOffsetMinutes: 180,
    occurrenceKey: EventModel.occurrenceKey("routine/bootdev", "2026-08-20")
  });
  let journal = EventModel.createJournal(DEVICE_ID);
  journal = EventModel.append(journal, beforeDst);
  journal = EventModel.append(journal, afterDst);

  const rebuilt = EventModel.rebuildProjection(EventModel.loadJournal(EventModel.exportJournal(journal)).journal);
  assert.deepEqual(rebuilt.countsByDailyXpDate, { "2026-08-19": 1, "2026-08-20": 1 });
  assert.deepEqual(rebuilt.uniqueOccurrenceKeys, [beforeDst.occurrenceKey, afterDst.occurrenceKey]);
});

test("occurrence identity is based on its frozen date, not later settings", () => {
  const key = EventModel.occurrenceKey("routine/anki", event().dailyXpDate);

  assert.equal(key, "routine:routine%2Fanki:day:2026-08-19");
  assert.equal(key, EventModel.occurrenceKey("routine/anki", "2026-08-19"));
  assert.notEqual(key, EventModel.occurrenceKey("routine/anki", "2026-08-20"));
});

test("canonical export round-trips and replays offline", () => {
  const journal = EventModel.append(EventModel.createJournal(DEVICE_ID), event());
  const raw = EventModel.exportJournal(journal);
  const loaded = EventModel.loadJournal(raw);

  assert.equal(loaded.ok, true);
  assert.equal(EventModel.exportJournal(loaded.journal), raw);
  assert.deepEqual(EventModel.rebuildProjection(loaded.journal), EventModel.rebuildProjection(journal));
});

test("malformed and unsupported input retain the exact original bytes", () => {
  const malformed = "{not-json\n";
  const unsupported = '{"schemaVersion":99,"deviceId":"' + DEVICE_ID + '","events":[]}\n';

  for (const raw of [malformed, unsupported]) {
    const loaded = EventModel.loadJournal(raw);
    assert.equal(loaded.ok, false);
    assert.equal(loaded.originalRaw, raw);
    assert.equal(loaded.recoverable, true);
    assert.match(loaded.message, /backup|version|valid/i);
  }
});

test("bounded version-0 migration produces a backup and deterministic v1 journal", () => {
  const legacy = JSON.stringify({ version: 0, deviceId: DEVICE_ID, events: [event()] });
  const migrated = EventModel.loadJournal(legacy);

  assert.equal(migrated.ok, true);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.backupRaw, legacy);
  assert.equal(migrated.journal.schemaVersion, 1);
  assert.equal(EventModel.loadJournal(EventModel.exportJournal(migrated.journal)).migrated, false);
});
