const test = require("node:test");
const assert = require("node:assert/strict");

const EventModel = require("../EventModel.js");
const StateModel = require("../StateModel.js");

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

test("failed journal replacement restarts from the exact envelope backup", () => {
  const legacyRaw = JSON.stringify({ version: 0, deviceId: DEVICE_ID, events: [] });
  const current = StateModel.withEventJournal(
    StateModel.createEnvelope({ probeEvents: ["legacy-probe"] }, 3),
    legacyRaw
  );
  const migration = EventModel.loadJournal(current.payload.eventJournalRaw);
  const replacement = StateModel.withEventJournal(current, EventModel.exportJournal(migration.journal));
  const plan = StateModel.savePlan(current, replacement);

  const restarted = StateModel.recoverDetailed("{torn primary replacement", plan.backupRaw);
  assert.equal(restarted.source, "backup");
  assert.deepEqual(restarted.envelope, current);
  assert.equal(restarted.envelope.payload.eventJournalRaw, legacyRaw);

  const restoredJournal = EventModel.loadJournal(restarted.envelope.payload.eventJournalRaw);
  assert.equal(restoredJournal.ok, true);
  assert.equal(restoredJournal.migrated, true);
  assert.equal(restoredJournal.backupRaw, legacyRaw);
});

test("completed journal replacement restarts on the validated new generation", () => {
  const journal = EventModel.createJournal(DEVICE_ID);
  const current = StateModel.createEnvelope({ probeEvents: [] }, 0);
  const replacement = StateModel.withEventJournal(current, EventModel.exportJournal(journal));
  const plan = StateModel.savePlan(current, replacement);

  const restarted = StateModel.recoverDetailed(plan.primaryRaw, plan.backupRaw);
  assert.equal(restarted.source, "primary");
  assert.equal(restarted.envelope.generation, 1);
  assert.equal(EventModel.loadJournal(restarted.envelope.payload.eventJournalRaw).ok, true);
});

test("unsupported embedded journal remains byte-exact and produces no replacement", () => {
  const unsupportedRaw = '{"schemaVersion":99,"deviceId":"' + DEVICE_ID + '","events":[]}\n';
  const envelope = StateModel.withEventJournal(
    StateModel.createEnvelope({ probeEvents: [] }, 0),
    unsupportedRaw
  );
  const loaded = EventModel.loadJournal(envelope.payload.eventJournalRaw);

  assert.equal(loaded.ok, false);
  assert.equal(loaded.originalRaw, unsupportedRaw);
  assert.match(loaded.message, /unsupported/);
  assert.equal(envelope.payload.eventJournalRaw, unsupportedRaw);
});
