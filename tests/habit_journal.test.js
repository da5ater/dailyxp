const test = require("node:test");
const assert = require("node:assert/strict");

const EventModel = require("../EventModel.js");
const HabitJournal = require("../HabitJournal.js");
const HabitModel = require("../HabitModel.js");

const DEVICE_ID = "11111111-1111-4111-8111-111111111111";

function journal() {
  return EventModel.createJournal(DEVICE_ID);
}

function context() {
  return {
    occurredAtUtc: "2026-08-20T00:30:00.000Z",
    localDateTime: "2026-08-20T03:30:00.000",
    timezone: "Africa/Cairo",
    utcOffsetMinutes: 180,
    dayBoundaryMinutes: 240
  };
}

test("persists habit intents through the versioned journal", () => {
  const empty = journal();
  const decided = HabitModel.decide(HabitModel.emptyProjection(), {
    type: "habit.create",
    habit: { id: "habit-study", title: "Study", schedule: { type: "daily" }, startDate: "2026-08-17", endDate: null, restDates: [] }
  });
  const next = HabitJournal.appendIntents(empty, decided.events, context(), EventModel);
  assert.equal(next.events.length, 1);
  assert.equal(next.events[0].type, "habit.created");
  const proj = HabitModel.project(next.events);
  assert.equal(proj.habits.length, 1);
});

test("journal append is idempotent by stable eventId", () => {
  const empty = journal();
  const decided = HabitModel.decide(HabitModel.emptyProjection(), {
    type: "habit.create",
    habit: { id: "habit-dup", title: "Dup", schedule: { type: "daily" }, startDate: "2026-08-17", endDate: null, restDates: [] }
  });
  const eventId = "22222222-2222-4222-8222-222222222222";
  const first = HabitJournal.appendIntents(empty, decided.events, { ...context(), eventIds: [eventId] }, EventModel);
  const second = HabitJournal.appendIntents(first, decided.events, { ...context(), eventIds: [eventId] }, EventModel);
  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0].eventId, eventId);
  assert.equal(HabitModel.project(second.events).habits.length, 1);
});

test("habit journal recovery preserves streak and cap after replay", () => {
  let j = journal();
  const cmds = [
    { type: "habit.create", habit: { id: "h-a", title: "A", schedule: { type: "daily" }, startDate: "2026-08-17", endDate: null, restDates: [] } },
    { type: "habit.create", habit: { id: "h-b", title: "B", schedule: { type: "daily" }, startDate: "2026-08-17", endDate: null, restDates: [] } },
    { type: "habit.day.advance", dailyXpDate: "2026-08-17" },
    { type: "habit.complete", habitId: "h-a", dailyXpDate: "2026-08-17" },
    { type: "habit.complete", habitId: "h-b", dailyXpDate: "2026-08-17" }
  ];
  let intents = [];
  let working = HabitModel.emptyProjection();
  cmds.forEach(c => { const r = HabitModel.decide(working, c); intents = intents.concat(r.events); working = HabitModel.projectIntents(working, r.events); });
  j = HabitJournal.appendIntents(j, intents, context(), EventModel);
  const exported = EventModel.exportJournal(j);
  const loaded = EventModel.loadJournal(exported);
  assert.equal(loaded.ok, true);
  const replay = HabitModel.project(loaded.journal.events);
  assert.equal(replay.dailySummaries["2026-08-17"].isFullSet, true);
  assert.equal(replay.dailySummaries["2026-08-17"].lifetimeXp, 90);
});
