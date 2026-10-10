const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const EventModel = require("../EventModel.js");
const SessionModel = require("../SessionModel.js");
const SessionJournal = require("../SessionJournal.js");
const StateModel = require("../StateModel.js");

function savedSession(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-session-bind-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "state.json");
  let journal = EventModel.createJournal(EventModel.uuidV4());
  let envelope = StateModel.createEnvelope(StateModel.emptyPayload(), 0);
  let projection = SessionModel.emptyProjection();
  function apply(command) {
    const atUtc = command.atUtc || command.session.startedAtUtc;
    const result = SessionModel.decide(projection, command);
    assert.equal(result.confirmation, undefined);
    const context = {
      occurredAtUtc: atUtc,
      localDateTime: atUtc.slice(0, -1),
      timezone: "Etc/UTC", utcOffsetMinutes: 0,
      systemTimezoneVerified: true, dayBoundaryMinutes: 240
    };
    journal = SessionJournal.appendIntents(journal, result.events, context, EventModel);
    envelope = StateModel.withEventJournal(envelope, EventModel.exportJournal(journal));
    fs.writeFileSync(file, StateModel.encode(envelope));
    projection = SessionModel.project(journal.events);
    return projection;
  }
  function reopen() {
    const recovered = StateModel.decode(fs.readFileSync(file, "utf8"));
    assert.equal(recovered.valid, true);
    envelope = recovered.envelope;
    const loaded = EventModel.loadJournal(envelope.payload.eventJournalRaw);
    assert.equal(loaded.ok, true);
    journal = loaded.journal;
    projection = SessionModel.project(journal.events);
    return projection;
  }
  return { apply, reopen, journal: () => journal };
}

function start(atUtc) {
  return { type: "session.start", session: {
    id: "rail-session", taskId: null, primarySkill: "general/focus",
    plannedMinutes: null, startedAtUtc: atUtc
  } };
}

test("rail session saves every transition, freezes pause time and emits one finished result after replay", (t) => {
  const store = savedSession(t);
  store.apply(start("2026-10-10T08:00:00.000Z"));
  store.apply({ type: "session.pause", atUtc: "2026-10-10T08:02:00.000Z" });
  let replayed = store.reopen();
  assert.equal(replayed.activeSession.status, "paused");
  assert.equal(SessionModel.summaryAt(replayed, "2026-10-10T08:12:00.000Z").focusedMilliseconds, 120000);
  store.apply({ type: "session.resume", atUtc: "2026-10-10T08:12:00.000Z" });
  replayed = store.reopen();
  assert.equal(replayed.activeSession.status, "running");
  assert.equal(SessionModel.summaryAt(replayed, "2026-10-10T08:15:00.000Z").focusedMilliseconds, 300000);
  store.apply({ type: "session.finish", atUtc: "2026-10-10T08:15:00.000Z" });
  replayed = store.reopen();
  assert.equal(replayed.activeSession, null);
  assert.equal(replayed.sessions.length, 1);
  assert.equal(replayed.sessions[0].focusedMilliseconds / 60000, 5);
  assert.equal(replayed.sessions[0].competitiveMilliseconds, 300000);
  assert.equal(store.journal().events.filter(event => event.type === "session.finished").length, 1);
  assert.deepEqual(store.reopen(), replayed);
});

test("running session reconstructs elapsed time from the saved open segment without double counting", (t) => {
  const store = savedSession(t);
  store.apply(start("2026-10-10T08:00:00.000Z"));
  store.apply({ type: "session.pause", atUtc: "2026-10-10T08:01:00.000Z" });
  store.apply({ type: "session.resume", atUtc: "2026-10-10T08:02:00.000Z" });
  for (let restart = 0; restart < 3; restart++) {
    const replayed = store.reopen();
    assert.equal(replayed.activeSession.id, "rail-session");
    assert.equal(SessionModel.summaryAt(replayed, "2026-10-10T08:05:00.000Z").focusedMilliseconds, 240000);
    assert.throws(() => SessionModel.decide(replayed, { ...start("2026-10-10T08:05:00.000Z"),
      session: { ...start("2026-10-10T08:05:00.000Z").session, id: "second" } }), /activeSession/);
  }
  store.apply({ type: "session.finish", atUtc: "2026-10-10T08:05:00.000Z" });
  const finished = store.reopen().sessions[0];
  assert.equal(finished.focusedMilliseconds, 240000);
  assert.equal(finished.segments.length, 2);
});

test("finish retains frozen day slices for downstream XP after a restart", (t) => {
  const store = savedSession(t);
  store.apply(start("2026-10-10T03:59:00.000Z"));
  const state = store.reopen();
  const dateAt = atUtc => EventModel.dailyXpDate(atUtc.slice(0, -1), 240);
  const slices = SessionModel.dailySlicesAt(state.activeSession, "2026-10-10T04:02:00.000Z", dateAt);
  store.apply({ type: "session.finish", atUtc: "2026-10-10T04:02:00.000Z",
    dailySlices: slices, sliceContext: { timezone: "Etc/UTC", dayBoundaryMinutes: 240 } });
  const finished = store.reopen().sessions[0];
  assert.deepEqual(finished.dailySlices, [
    { dailyXpDate: "2026-10-09", milliseconds: 60000 },
    { dailyXpDate: "2026-10-10", milliseconds: 120000 }
  ]);
  assert.equal(finished.focusedMilliseconds, 180000);
  assert.deepEqual(finished.sliceContext, { timezone: "Etc/UTC", dayBoundaryMinutes: 240 });
});
