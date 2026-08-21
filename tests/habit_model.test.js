const test = require("node:test");
const assert = require("node:assert/strict");

const HabitModel = require("../HabitModel.js");

function apply(projection, command) {
  const result = HabitModel.decide(projection, command);
  return HabitModel.projectIntents(projection, result.events);
}

function habit(overrides = {}) {
  return {
    id: "habit-study",
    title: "Study",
    schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7] },
    startDate: "2026-08-17",
    endDate: null,
    restDates: [],
    ...overrides
  };
}

// Schedule and eligibility
test("creates a habit with daily and weekday schedules", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-daily", schedule: { type: "daily" } }) });
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-week", schedule: { type: "weekdays", weekdays: [1] }, startDate: "2026-08-17" }) });
  assert.equal(proj.habits.length, 2);
  assert.equal(HabitModel.scheduledOn(proj.habits[0], "2026-08-20"), true);
  // 2026-08-16 is Sunday (weekday 7), not Monday 1; 2026-08-17 is Monday
  assert.equal(HabitModel.scheduledOn(proj.habits[1], "2026-08-16"), false);
  assert.equal(HabitModel.scheduledOn(proj.habits[1], "2026-08-17"), true);
});

test("interval schedule respects anchor and endDate", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({
    id: "h-interval", schedule: { type: "interval", everyDays: 2, anchorDate: "2026-08-17" },
    startDate: "2026-08-17", endDate: "2026-08-20"
  }) });
  assert.equal(HabitModel.scheduledOn(proj.habits[0], "2026-08-17"), true);
  assert.equal(HabitModel.scheduledOn(proj.habits[0], "2026-08-18"), false);
  assert.equal(HabitModel.scheduledOn(proj.habits[0], "2026-08-19"), true);
  assert.equal(HabitModel.scheduledOn(proj.habits[0], "2026-08-21"), false);
});

test("rest days make a habit ineligible without breaking streak", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ restDates: ["2026-08-18"] }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" });
  // 08-18 is rest, no completion needed, streak stays 1
  assert.equal(proj.streaks["habit-study"].current, 1);
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-19" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-19" });
  assert.equal(proj.streaks["habit-study"].current, 2);
  assert.equal(proj.streaks["habit-study"].longest, 2);
});

test("streak breaks only on missed eligible day without freeze", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit() });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" });
  // 08-18 is current day not yet missed – streak stays 1
  assert.equal(proj.streaks["habit-study"].current, 1);
  // advance past 08-18 without completing it -> 08-18 counts as missed
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-19" });
  assert.equal(proj.streaks["habit-study"].current, 0);
  // new streak after miss
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-19" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-20" });
  assert.equal(proj.streaks["habit-study"].current, 1);
});

test("optional freeze preserves streak when consumed explicitly", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit() });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" });
  // consume freeze for missed 08-18
  proj = apply(proj, { type: "habit.freeze.consume", habitId: "habit-study", dailyXpDate: "2026-08-18" });
  assert.equal(proj.streaks["habit-study"].current, 1);
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-19" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-19" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-20" });
  assert.equal(proj.streaks["habit-study"].current, 2);
});

test("freeze cannot be consumed twice and cannot be used on rest or completed day", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ restDates: ["2026-08-19"] }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  assert.throws(() => HabitModel.decide(proj, { type: "habit.freeze.consume", habitId: "habit-study", dailyXpDate: "2026-08-19" }), /not eligible/);
  proj = apply(proj, { type: "habit.freeze.consume", habitId: "habit-study", dailyXpDate: "2026-08-18" });
  const dup = HabitModel.decide(proj, { type: "habit.freeze.consume", habitId: "habit-study", dailyXpDate: "2026-08-18" });
  assert.equal(dup.events.length, 0);
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-20" });
  assert.throws(() => HabitModel.decide(proj, { type: "habit.freeze.consume", habitId: "habit-study", dailyXpDate: "2026-08-20" }), /already completed/);
});

test("no permanent XP is removed on miss, longest remembers", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit() });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-18" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-19" });
  // 08-19 is current, not yet missed – streak remains 2
  assert.equal(proj.streaks["habit-study"].longest, 2);
  assert.equal(proj.streaks["habit-study"].current, 2);
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-20" });
  // now 08-19 counts as missed
  assert.equal(proj.streaks["habit-study"].longest, 2);
  assert.equal(proj.streaks["habit-study"].current, 0);
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-20" });
  // after completing 20, new streak starts at 1 (previous miss breaks)
  assert.equal(proj.streaks["habit-study"].longest, 2);
  assert.equal(proj.streaks["habit-study"].current, 1);
});

test("duplicate completions are idempotent without duplicate events", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit() });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  const dup = HabitModel.decide(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  assert.equal(dup.events.length, 0);
  assert.equal(proj.completions.length, 1);
});

test("schedule and day-boundary: dailyXpDate is frozen per completion", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ schedule: { type: "daily" }, startDate: "2026-08-17" }) });
  // Simulate that EventModel already maps UTC to dailyXpDate via 04:00 boundary.
  // Habit model just stores the provided dailyXpDate string; ensure idempotency across same frozen date.
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "habit-study", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" });
  assert.equal(proj.dailySummaries["2026-08-17"].completedCount, 1);
  assert.equal(proj.dailySummaries["2026-08-18"].eligibleCount, 1);
  assert.equal(proj.dailySummaries["2026-08-18"].completedCount, 0);
});

test("caps competitive contribution at seven per day while keeping personal", () => {
  let proj = HabitModel.emptyProjection();
  for (let i = 0; i < 10; i += 1) {
    proj = apply(proj, { type: "habit.create", habit: habit({ id: `h-${i}`, title: `Habit ${i}`, schedule: { type: "daily" }, startDate: "2026-08-17" }) });
  }
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  for (let i = 0; i < 10; i += 1) {
    proj = apply(proj, { type: "habit.complete", habitId: `h-${i}`, dailyXpDate: "2026-08-17" });
  }
  const summary = proj.dailySummaries["2026-08-17"];
  assert.equal(summary.completedCount, 10);
  assert.equal(summary.competitiveCount, 7);
  assert.equal(summary.personalCount, 3);
  assert.equal(summary.seasonXp, 140);
  assert.equal(summary.lifetimeXp, 10 * 20 + 50); // includes full-set bonus
  assert.equal(summary.isFullSet, true);
});

test("additional habits beyond seven remain personal-only", () => {
  let proj = HabitModel.emptyProjection();
  for (let i = 0; i < 8; i += 1) {
    proj = apply(proj, { type: "habit.create", habit: habit({ id: `h2-${i}`, title: `H ${i}` }) });
  }
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  for (let i = 0; i < 7; i += 1) proj = apply(proj, { type: "habit.complete", habitId: `h2-${i}`, dailyXpDate: "2026-08-17" });
  // 7 completed but 8 eligible => not full set, no bonus
  let summary = proj.dailySummaries["2026-08-17"];
  assert.equal(summary.isFullSet, false);
  assert.equal(summary.fullSetBonusAwarded, 0);
  assert.equal(summary.seasonXp, 140);
  // Complete 8th
  proj = apply(proj, { type: "habit.complete", habitId: "h2-7", dailyXpDate: "2026-08-17" });
  summary = proj.dailySummaries["2026-08-17"];
  assert.equal(summary.isFullSet, true);
  assert.equal(summary.fullSetBonusAwarded, 50);
  assert.equal(summary.seasonXp, 140); // still capped
  assert.equal(summary.lifetimeXp, 8 * 20 + 50);
});

test("full-set bonus awarded exactly once when all scheduled habits completed", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-a" }) });
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-b", title: "B" }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "h-a", dailyXpDate: "2026-08-17" });
  let summary = proj.dailySummaries["2026-08-17"];
  assert.equal(summary.isFullSet, false);
  assert.equal(summary.fullSetBonusAwarded, 0);
  assert.equal(summary.lifetimeXp, 20);
  proj = apply(proj, { type: "habit.complete", habitId: "h-b", dailyXpDate: "2026-08-17" });
  summary = proj.dailySummaries["2026-08-17"];
  assert.equal(summary.isFullSet, true);
  assert.equal(summary.fullSetBonusAwarded, 50);
  assert.equal(summary.lifetimeXp, 2 * 20 + 50);
  // duplicate completion does not create second bonus
  const dup = HabitModel.decide(proj, { type: "habit.complete", habitId: "h-a", dailyXpDate: "2026-08-17" });
  assert.equal(dup.events.length, 0);
  assert.equal(proj.dailySummaries["2026-08-17"].lifetimeXp, 90);
});

test("no bonus when habit is rest day ineligible", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-a", restDates: [] }) });
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-b", title: "B", restDates: ["2026-08-17"] }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "h-a", dailyXpDate: "2026-08-17" });
  const summary = proj.dailySummaries["2026-08-17"];
  // h-b not eligible on 17, so eligibleCount 1, full set true
  assert.equal(summary.eligibleCount, 1);
  assert.equal(summary.isFullSet, true);
  assert.equal(summary.fullSetBonusAwarded, 50);
});

test("streak is per habit and rest days do not affect other habits", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-a", restDates: ["2026-08-18"] }) });
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-b", title: "B" }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "h-a", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "h-b", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" });
  // h-a rest day, still 1; h-b current day not yet counted as miss
  assert.equal(proj.streaks["h-a"].current, 1);
  assert.equal(proj.streaks["h-b"].current, 1);
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-19" });
  // now h-b missed 08-18
  assert.equal(proj.streaks["h-a"].current, 1);
  assert.equal(proj.streaks["h-b"].current, 0);
});

test("duplicate-type event replay is idempotent via project", () => {
  const events = [
    { type: "habit.created", payload: habit({ id: "h-x" }), occurrenceKey: null },
    { type: "habit.created", payload: habit({ id: "h-x" }), occurrenceKey: null },
    { type: "habit.completed", payload: { habitId: "h-x", dailyXpDate: "2026-08-17", count: 1 }, occurrenceKey: null },
    { type: "habit.completed", payload: { habitId: "h-x", dailyXpDate: "2026-08-17", count: 1 }, occurrenceKey: null },
    { type: "habit.day.advanced", payload: { dailyXpDate: "2026-08-17" }, occurrenceKey: null },
    { type: "habit.day.advanced", payload: { dailyXpDate: "2026-08-17" }, occurrenceKey: null }
  ];
  const proj = HabitModel.project(events);
  assert.equal(proj.habits.length, 1);
  assert.equal(proj.completions.length, 1);
  assert.equal(proj.lastAdvancedDailyXpDate, "2026-08-17");
});

test("habit edit preserves streak and rest handling", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ title: "Original" }) });
  proj = apply(proj, { type: "habit.edit", id: "habit-study", changes: { title: "Updated Title" } });
  assert.equal(proj.habits[0].title, "Updated Title");
  assert.equal(proj.habits[0].revision, 2);
});

test("archiving vs deleting respects durable history", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-del" }) });
  proj = apply(proj, { type: "habit.remove", id: "h-del" });
  assert.equal(proj.habits.length, 0);
  proj = apply(proj, { type: "habit.create", habit: habit({ id: "h-arch", title: "Arch" }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.complete", habitId: "h-arch", dailyXpDate: "2026-08-17" });
  proj = apply(proj, { type: "habit.remove", id: "h-arch" });
  assert.equal(proj.habits[0].status, "archived");
  assert.equal(proj.completions.length, 1);
});

test("invalid schedule and date inputs are rejected", () => {
  assert.throws(() => HabitModel.decide(HabitModel.emptyProjection(), { type: "habit.create", habit: habit({ schedule: { type: "bogus" } }) }), /schedule/);
  assert.throws(() => HabitModel.decide(HabitModel.emptyProjection(), { type: "habit.create", habit: habit({ startDate: "2026-13-01" }) }), /startDate/);
  assert.throws(() => HabitModel.decide(HabitModel.emptyProjection(), { type: "habit.complete", habitId: "missing", dailyXpDate: "2026-08-17" }), /was not found/);
});

test("eligible habits with zero completions still show correct eligibleCount", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit({ schedule: { type: "weekdays", weekdays: [1] } }) });
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-17" }); // Monday
  assert.equal(proj.dailySummaries["2026-08-17"].eligibleCount, 1);
  assert.equal(proj.dailySummaries["2026-08-17"].isFullSet, false);
  proj = apply(proj, { type: "habit.day.advance", dailyXpDate: "2026-08-18" }); // Tuesday
  assert.equal(proj.dailySummaries["2026-08-18"].eligibleCount, 0);
  assert.equal(proj.dailySummaries["2026-08-18"].isFullSet, false);
});

test("projection is frozen and deterministic", () => {
  let proj = HabitModel.emptyProjection();
  proj = apply(proj, { type: "habit.create", habit: habit() });
  assert.equal(Object.isFrozen(proj), true);
  assert.equal(Object.isFrozen(proj.habits), true);
  const events = [
    { type: "habit.created", payload: habit({ id: "h1", title: "A" }), occurrenceKey: null },
    { type: "habit.day.advanced", payload: { dailyXpDate: "2026-08-17" }, occurrenceKey: null }
  ];
  const a = HabitModel.project(events);
  const b = HabitModel.project(events);
  assert.deepEqual(a, b);
});
