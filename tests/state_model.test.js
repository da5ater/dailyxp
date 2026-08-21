const test = require("node:test");
const assert = require("node:assert/strict");

const StateModel = require("../StateModel.js");

test("round-trips a valid versioned envelope", () => {
  const envelope = StateModel.createEnvelope({ probeEvents: ["probe-1"] }, 7);
  const decoded = StateModel.decode(StateModel.encode(envelope));

  assert.equal(decoded.valid, true);
  assert.equal(decoded.envelope.generation, 7);
  assert.deepEqual(decoded.envelope.payload, { probeEvents: ["probe-1"] });
});

test("rejects a torn or modified write", () => {
  const raw = StateModel.encode(StateModel.createEnvelope({ probeEvents: [] }, 1));
  const modified = raw.replace('"generation":1', '"generation":2');

  assert.equal(StateModel.decode(modified).valid, false);
});

test("recovers the newest valid slot and falls back from corrupt primary", () => {
  const oldRaw = StateModel.encode(StateModel.createEnvelope({ probeEvents: ["old"] }, 4));
  const newRaw = StateModel.encode(StateModel.createEnvelope({ probeEvents: ["old", "new"] }, 5));

  assert.deepEqual(StateModel.recover(oldRaw, newRaw).payload.probeEvents, ["old", "new"]);
  assert.deepEqual(StateModel.recover("{torn", oldRaw).payload.probeEvents, ["old"]);
  assert.deepEqual(StateModel.recover(oldRaw, "{torn").payload.probeEvents, ["old"]);
});

test("uses a valid primary on equal generations", () => {
  const primary = StateModel.encode(StateModel.createEnvelope({ probeEvents: ["primary"] }, 2));
  const backup = StateModel.encode(StateModel.createEnvelope({ probeEvents: ["backup"] }, 2));

  assert.deepEqual(StateModel.recover(primary, backup).payload.probeEvents, ["primary"]);
});

test("starts from an empty valid state when neither slot is usable", () => {
  const recovered = StateModel.recover("", "not-json");

  assert.equal(recovered.generation, 0);
  assert.deepEqual(recovered.payload, { probeEvents: [] });
});

test("distinguishes a fresh start from unrecoverable bytes without overwriting them", () => {
  const fresh = StateModel.recoverDetailed("", "");
  const damaged = StateModel.recoverDetailed("{torn", "unsupported");

  assert.equal(fresh.fresh, true);
  assert.equal(fresh.error, "");
  assert.equal(damaged.fresh, false);
  assert.match(damaged.error, /left unchanged/);
  assert.equal(damaged.source, "none");
});

test("adding a probe event is idempotent and does not mutate prior state", () => {
  const initial = StateModel.createEnvelope({ probeEvents: ["probe-1"] }, 3);
  const duplicate = StateModel.addProbeEvent(initial, "probe-1");
  const added = StateModel.addProbeEvent(initial, "probe-2");

  assert.equal(duplicate, initial);
  assert.deepEqual(initial.payload.probeEvents, ["probe-1"]);
  assert.deepEqual(added.payload.probeEvents, ["probe-1", "probe-2"]);
  assert.equal(added.generation, 4);
});

test("save plan keeps the prior valid envelope as backup", () => {
  const current = StateModel.createEnvelope({ probeEvents: ["probe-1"] }, 9);
  const next = StateModel.addProbeEvent(current, "probe-2");
  const plan = StateModel.savePlan(current, next);

  assert.deepEqual(StateModel.decode(plan.backupRaw).envelope, current);
  assert.deepEqual(StateModel.decode(plan.primaryRaw).envelope, next);
});

test("journal initialization preserves legacy probe envelopes", () => {
  const legacy = StateModel.createEnvelope({ probeEvents: ["probe-1"] }, 3);
  const legacyRaw = StateModel.encode(legacy);
  const upgraded = StateModel.withEventJournal(legacy, '{"schemaVersion":1}\n');

  assert.equal(StateModel.decode(legacyRaw).valid, true);
  assert.deepEqual(upgraded.payload.probeEvents, ["probe-1"]);
  assert.equal(upgraded.payload.eventJournalRaw, '{"schemaVersion":1}\n');
  assert.equal(upgraded.generation, 4);
});

test("a probe and its canonical journal commit in one envelope generation", () => {
  const initial = StateModel.withEventJournal(
    StateModel.createEnvelope({ probeEvents: [] }, 0),
    '{"events":[]}\n'
  );
  const recorded = StateModel.recordProbe(initial, "probe-1", '{"events":["probe-1"]}\n');

  assert.equal(recorded.generation, initial.generation + 1);
  assert.deepEqual(recorded.payload.probeEvents, ["probe-1"]);
  assert.equal(recorded.payload.eventJournalRaw, '{"events":["probe-1"]}\n');
});

test("every interrupted save boundary recovers a whole generation", () => {
  const current = StateModel.createEnvelope({ probeEvents: ["probe-1"] }, 1);
  const next = StateModel.addProbeEvent(current, "probe-2");
  const currentRaw = StateModel.encode(current);
  const plan = StateModel.savePlan(current, next);
  const boundaries = [
    ["before backup", currentRaw, "", current],
    ["after backup", currentRaw, plan.backupRaw, current],
    ["after primary", plan.primaryRaw, plan.backupRaw, next],
    ["torn primary", "{torn", plan.backupRaw, current],
    ["torn backup", currentRaw, "{torn", current],
    ["torn backup after primary", plan.primaryRaw, "{torn", next]
  ];

  for (const [name, primaryRaw, backupRaw, expected] of boundaries) {
    assert.deepEqual(StateModel.recover(primaryRaw, backupRaw), expected, name);
  }
});

test("recovery never invents or duplicates an event across torn writes", () => {
  const current = StateModel.createEnvelope({ probeEvents: ["probe-1"] }, 4);
  const next = StateModel.addProbeEvent(current, "probe-2");
  const plan = StateModel.savePlan(current, next);

  // Torn primary: recovers backup (current), re-applying same probe stays idempotent
  const recovered = StateModel.recover("{torn", plan.backupRaw);
  assert.equal(recovered.generation, current.generation);
  assert.deepEqual(recovered.payload.probeEvents, ["probe-1"]);
  assert.equal(StateModel.addProbeEvent(recovered, "probe-1"), recovered);

  // Primary wins on equal generation after a torn backup
  const recoveredFromBackupTorn = StateModel.recover(plan.primaryRaw, "{torn");
  assert.equal(recoveredFromBackupTorn.generation, next.generation);
  assert.deepEqual(recoveredFromBackupTorn.payload.probeEvents, ["probe-1", "probe-2"]);

  // Neither slot valid surfaces actionable state without overwriting
  const damaged = StateModel.recoverDetailed("{torn primary", "{torn backup");
  assert.equal(damaged.source, "none");
  assert.equal(damaged.fresh, false);
  assert.match(damaged.error, /left unchanged/);
});
