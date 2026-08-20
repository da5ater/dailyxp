const test = require("node:test");
const assert = require("node:assert/strict");

const EventModel = require("../EventModel.js");
const PlanningJournal = require("../PlanningJournal.js");
const PlanningModel = require("../PlanningModel.js");
const StateModel = require("../StateModel.js");

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

test("planning intents survive the same primary and backup journal persistence seam", () => {
  const emptyJournal = EventModel.createJournal(DEVICE_ID);
  const outcome = PlanningModel.decide(PlanningModel.emptyProjection(), {
    type: "task.create",
    task: { id: "task-plugin", title: "Build DailyXP", estimateMinutes: 120, urgency: "urgent",
      deadline: null, primarySkill: "backend/build", goalId: null, milestoneId: null }
  });
  const journal = PlanningJournal.appendIntents(emptyJournal, outcome.events, {
    occurredAtUtc: "2026-08-21T08:00:00.000Z",
    localDateTime: "2026-08-21T11:00:00.000",
    timezone: "Africa/Cairo", utcOffsetMinutes: 180, dayBoundaryMinutes: 240,
    eventIds: ["22222222-2222-4222-8222-222222222222"]
  }, EventModel);
  const current = StateModel.createEnvelope(StateModel.emptyPayload(), 0);
  const next = StateModel.withEventJournal(current, EventModel.exportJournal(journal));
  const save = StateModel.savePlan(current, next);
  const restarted = StateModel.recoverDetailed(save.primaryRaw, save.backupRaw);
  const loaded = EventModel.loadJournal(restarted.envelope.payload.eventJournalRaw);
  const plan = PlanningModel.project(loaded.journal.events);

  assert.equal(plan.tasks[0].title, "Build DailyXP");
  assert.equal(loaded.journal.events[0].type, "planning.task.created");
  assert.equal(restarted.source, "primary");
});
