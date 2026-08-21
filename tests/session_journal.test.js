const test = require("node:test");
const assert = require("node:assert/strict");

const EventModel = require("../EventModel.js");
const SessionJournal = require("../SessionJournal.js");
const SessionModel = require("../SessionModel.js");
const StateModel = require("../StateModel.js");

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

test("an active Session survives the versioned backup and restart seam", () => {
  const outcome = SessionModel.decide(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-restart", taskId: "task-dailyxp", primarySkill: "backend/build",
      plannedMinutes: 90, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  });
  const journal = SessionJournal.appendIntents(EventModel.createJournal(DEVICE_ID), outcome.events, {
    occurredAtUtc: "2026-08-21T08:00:00.000Z",
    localDateTime: "2026-08-21T11:00:00.000",
    timezone: "Africa/Cairo", utcOffsetMinutes: 180, dayBoundaryMinutes: 240,
    eventIds: ["22222222-2222-4222-8222-222222222222"]
  }, EventModel);
  const current = StateModel.createEnvelope(StateModel.emptyPayload(), 0);
  const next = StateModel.withEventJournal(current, EventModel.exportJournal(journal));
  const save = StateModel.savePlan(current, next);
  const recovered = StateModel.recoverDetailed(save.primaryRaw, save.backupRaw);
  const loaded = EventModel.loadJournal(recovered.envelope.payload.eventJournalRaw);
  const sessions = SessionModel.project(loaded.journal.events);

  assert.equal(sessions.activeSession.id, "session-restart");
  assert.equal(SessionModel.summaryAt(sessions, "2026-08-21T08:45:00.000Z").focusedMilliseconds,
    45 * 60000);
  assert.equal(recovered.source, "primary");
});
