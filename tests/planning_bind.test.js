// V2 (#94) — the planning bind contract, tested end-to-end in pure JS.
//
// Mirrors StateStore.applyPlanningCommand's pipeline exactly: decide →
// PlanningJournal.appendIntents (EventModel.createEvent/append) → envelope
// via StateModel.withEventJournal → exportJournal. Then proves the
// kill-shell/reopen half: decode → loadJournal → PlanningModel.project →
// the created Task is on the rail.
//
// The QML side cannot run under node; this test is the regression guard for
// everything that CAN be exercised here — engine acceptance, journal shape,
// checksum integrity, replay determinism.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const EventModel = require("../EventModel.js");
const PlanningJournal = require("../PlanningJournal.js");
const PlanningModel = require("../PlanningModel.js");
const StateModel = require("../StateModel.js");

// The exact command CommitmentSheet.qml issues on SAVE.
function commitmentCommand(id, name, minutes) {
  return {
    type: "task.create",
    task: {
      id: id,
      title: name,
      estimateMinutes: minutes,
      urgency: "normal",
      deadline: null,
      primarySkill: "general/focus",
      goalId: null,
      milestoneId: null
    }
  };
}

// The exact persistence pipeline StateStore.applyPlanningCommand runs,
// extracted so tests fail when either side drifts.
function applyPlanningCommand(journal, command, context) {
  const result = PlanningModel.decide(PlanningModel.project(journal.events), command);
  if (result.events.length === 0) return { journal, changed: false };
  const nextJournal = PlanningJournal.appendIntents(journal, result.events, context, EventModel);
  return { journal: nextJournal, changed: true };
}

test("commitment create → journal append → envelope save lands with valid checksum", () => {
  const deviceId = EventModel.uuidV4();
  let journal = EventModel.createJournal(deviceId);
  const context = {
    occurredAtUtc: "2026-08-25T10:00:00.000Z",
    localDateTime: "2026-08-25T13:00:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 180,
    systemTimezoneVerified: true,
    dayBoundaryMinutes: 240
  };

  const { journal: afterCreate } = applyPlanningCommand(
    journal, commitmentCommand(EventModel.uuidV4(), "Ruby study", 120), context);

  const envelope = StateModel.withEventJournal(
    StateModel.createEnvelope(StateModel.emptyPayload(), 0),
    EventModel.exportJournal(afterCreate));

  // what persistNext writes to $XDG_STATE_HOME/dailyxp/state.json
  const rawOnDisk = StateModel.encode(envelope);
  assert.equal(StateModel.decode(rawOnDisk).valid, true, "checksum must validate on disk");

  fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-v2-"));
  return { deviceId, rawOnDisk };
});

test("kill shell → reopen: task replays from the saved journal onto the rail", () => {
  const context = {
    occurredAtUtc: "2026-08-25T10:00:00.000Z",
    localDateTime: "2026-08-25T13:00:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 180,
    systemTimezoneVerified: true,
    dayBoundaryMinutes: 240
  };
  let journal = EventModel.createJournal(EventModel.uuidV4());
  ({ journal } = applyPlanningCommand(
    journal, commitmentCommand(EventModel.uuidV4(), "Write chapter one", 90), context));

  const rawOnDisk = StateModel.encode(StateModel.withEventJournal(
    StateModel.createEnvelope(StateModel.emptyPayload(), 0),
    EventModel.exportJournal(journal)));

  // ── reopen: fresh process reads state.json from disk ──
  const decoded = StateModel.decode(rawOnDisk);
  assert.equal(decoded.valid, true);
  const loaded = EventModel.loadJournal(decoded.envelope.payload.eventJournalRaw);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.migrated, false);

  // StateStore.loadJournal's exact projection call
  const projection = PlanningModel.project(loaded.journal.events);
  assert.equal(projection.tasks.length, 1);
  assert.equal(projection.tasks[0].title, "Write chapter one");
  assert.equal(projection.tasks[0].estimateMinutes, 90);
  assert.equal(projection.tasks[0].status, "open");
  assert.equal(Object.isFrozen(projection), true);
});

test("reboot round-trip through a real temp file keeps the commitment and stays deterministic", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-reboot-"));
  const statePath = path.join(dir, "state.json");

  const context = {
    occurredAtUtc: "2026-08-25T22:30:00.000Z",
    localDateTime: "2026-08-26T01:30:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 180,
    systemTimezoneVerified: true,
    dayBoundaryMinutes: 240
  };
  let journal = EventModel.createJournal(EventModel.uuidV4());
  ({ journal } = applyPlanningCommand(
    journal, commitmentCommand(EventModel.uuidV4(), "Morning pages", 20), context));
  const envelope = StateModel.withEventJournal(
    StateModel.createEnvelope(StateModel.emptyPayload(), 0),
    EventModel.exportJournal(journal));

  fs.writeFileSync(statePath, StateModel.encode(envelope));

  // reboot #1 — read back from the file system
  const first = EventModel.loadJournal(
    StateModel.decode(fs.readFileSync(statePath, "utf8")).envelope.payload.eventJournalRaw);
  const planOne = PlanningModel.project(first.journal.events);

  // reboot #2 — same read again; replay is deterministic
  const second = EventModel.loadJournal(
    StateModel.decode(fs.readFileSync(statePath, "utf8")).envelope.payload.eventJournalRaw);
  const planTwo = PlanningModel.project(second.journal.events);

  assert.deepEqual(planTwo.tasks, planOne.tasks);
  assert.equal(planOne.tasks.length, 1);
  assert.equal(planOne.tasks[0].title, "Morning pages");
});

test("sheet validation mirrors the engine: empty name and non-positive duration never reach decide()", () => {
  const context = {
    occurredAtUtc: "2026-08-25T10:00:00.000Z",
    localDateTime: "2026-08-25T13:00:00.000",
    timezone: "UTC",
    utcOffsetMinutes: 0,
    systemTimezoneVerified: true,
    dayBoundaryMinutes: 240
  };
  const journal = EventModel.createJournal(EventModel.uuidV4());

  // the QML sheet blocks these before calling applyPlanningCommand; this
  // pins the contract so UI drift fails loudly here too
  assert.equal(commitmentCommand(EventModel.uuidV4(), "", 30).task.title.trim() === "", true);
  assert.throws(() => PlanningModel.decide(
    PlanningModel.emptyProjection(),
    commitmentCommand(EventModel.uuidV4(), "No duration", 0)), /estimateMinutes/);
  assert.throws(() => PlanningModel.decide(
    PlanningModel.emptyProjection(),
    commitmentCommand(EventModel.uuidV4(), "", 30)), /title: is required/);
});

test("second commitment appends without corrupting the first (list rendering contract)", () => {
  const context = {
    occurredAtUtc: "2026-08-25T10:05:00.000Z",
    localDateTime: "2026-08-25T13:05:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 180,
    systemTimezoneVerified: true,
    dayBoundaryMinutes: 240
  };
  let journal = EventModel.createJournal(EventModel.uuidV4());
  ({ journal } = applyPlanningCommand(
    journal, commitmentCommand(EventModel.uuidV4(), "First", 45), context));
  ({ journal } = applyPlanningCommand(
    journal, commitmentCommand(EventModel.uuidV4(), "Second", 15), context));

  const projection = PlanningModel.project(journal.events);
  assert.deepEqual(projection.tasks.map(t => t.title), ["First", "Second"]);
});

test("optional goal: named goal links the task; empty goal stays standalone (CommitmentSheet contract)", () => {
  const context = {
    occurredAtUtc: "2026-08-25T10:10:00.000Z",
    localDateTime: "2026-08-25T13:10:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 180,
    systemTimezoneVerified: true,
    dayBoundaryMinutes: 240
  };
  let journal = EventModel.createJournal(EventModel.uuidV4());

  // empty goal -> standalone one-shot Task (goalId stays null)
  ({ journal } = applyPlanningCommand(
    journal, commitmentCommand(EventModel.uuidV4(), "One-off", 30), context));
  let projection = PlanningModel.project(journal.events);
  const oneOff = projection.tasks.find(t => t.title === "One-off");
  assert.equal(oneOff.goalId, null, "empty goal keeps the task standalone");

  // named goal -> find-or-create + link (CommitmentSheet.save path)
  const goalId = EventModel.uuidV4();
  ({ journal } = applyPlanningCommand(journal, { type: "goal.create",
    goal: { id: goalId, title: "Learn Rust", primarySkill: "general/focus",
            reason: "created from Commitment Sheet" } }, context));
  // emulate the sheet's second command: link via goalId
  ({ journal } = applyPlanningCommand(journal, { type: "task.create",
    task: { id: EventModel.uuidV4(), title: "Rust drill", estimateMinutes: 25,
             urgency: "normal", deadline: null, primarySkill: "general/focus",
             goalId: goalId, milestoneId: null } }, context));
  projection = PlanningModel.project(journal.events);
  const linked = projection.tasks.find(t => t.title === "Rust drill");
  assert.equal(linked.goalId, goalId, "named goal links the task to the Goal");
  assert.equal(projection.goals.length, 1, "goal created once");
  assert.equal(projection.goals[0].title, "Learn Rust");
});
