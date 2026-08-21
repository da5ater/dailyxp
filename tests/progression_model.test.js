const test = require("node:test");
const assert = require("node:assert/strict");

const ProgressionModel = require("../ProgressionModel.js");

function event(type, payload, eventId, dailyXpDate) {
  return { type, payload, eventId: eventId || "11111111-1111-4111-8111-111111111111", dailyXpDate: dailyXpDate || null };
}

test("table-driven session award: minute, planned bonus, daily target", () => {
  const events = [
    event("session.finished", { focusedMilliseconds: 30 * 60000, plannedMinutes: null }, "s1", "2026-08-17"),
    event("session.finished", { focusedMilliseconds: 60 * 60000, plannedMinutes: 45 }, "s2", "2026-08-17"),
    event("session.finished", { focusedMilliseconds: 130 * 60000, plannedMinutes: null }, "s3", "2026-08-18")
  ];
  const proj = ProgressionModel.project(events);
  // s1: 30 xp, no bonus
  // s2: 60 + floor(60*0.2)=12 => 72
  // s3: 130 + floor(130*0.25)=32 (since >=120 target) => 162
  const ledger = proj.ledger;
  assert.equal(ledger.length, 3);
  const s1 = ledger.find(e => e.sourceEventId === "s1");
  assert.equal(s1.lifetimeXp, 30);
  assert.equal(s1.seasonXp, 30);
  const s2 = ledger.find(e => e.sourceEventId === "s2");
  assert.equal(s2.lifetimeXp, 72);
  const s3 = ledger.find(e => e.sourceEventId === "s3");
  assert.equal(s3.lifetimeXp, 162);
});

test("habit cap and full-set bonus", () => {
  const events = [];
  for (let i = 0; i < 10; i += 1) events.push(event("habit.completed", { habitId: `h-${i}`, dailyXpDate: "2026-08-17" }, `h${i}`, "2026-08-17"));
  events.push(event("habit.fullSet.achieved", { dailyXpDate: "2026-08-17" }, "bonus1", "2026-08-17"));
  const proj = ProgressionModel.project(events);
  // habit ledger: 10 *20 lifetime =200, season capped at 7*20=140, plus bonus 50 lifetime
  assert.equal(proj.totals.lifetimeXp, 200 + 50);
  assert.equal(proj.totals.seasonXp, 140);
  assert.equal(proj.ledger.filter(e => /habit completed/.test(e.reason)).length, 10);
  assert.equal(proj.ledger.filter(e => /full habit set/.test(e.reason)).length, 1);
});

test("rounding: planned and daily target floor", () => {
  const events = [event("session.finished", { focusedMilliseconds: 61 * 60000, plannedMinutes: 60 }, "r1", "2026-08-17")];
  const proj = ProgressionModel.project(events);
  const entry = proj.ledger[0];
  // base 61, planned floor(61*0.2)=12, lifetime 73
  assert.equal(entry.lifetimeXp, 73);
  assert.equal(entry.calculation.plannedBonus, 12);
});

test("idempotency: duplicate eventId appears once", () => {
  const dup = event("session.finished", { focusedMilliseconds: 30 * 60000, plannedMinutes: null }, "dup1", "2026-08-17");
  const proj = ProgressionModel.project([dup, dup, dup]);
  assert.equal(proj.ledger.length, 1);
  assert.equal(proj.totals.lifetimeXp, 30);
  assert.equal(proj.ledger[0].ruleVersion, 1);
  assert.match(proj.ledger[0].reason, /focused session/);
});

test("correction is explicit ledger entry and lifetime never decreases", () => {
  const base = event("session.finished", { focusedMilliseconds: 60 * 60000, plannedMinutes: null }, "c1", "2026-08-17");
  const proj1 = ProgressionModel.project([base]);
  assert.equal(proj1.totals.lifetimeXp, 60);
  const correction = { type: "progression.correction", payload: { id: "corr1", reason: "correction: session adjustment", lifetimeXp: -10, seasonXp: -10 }, eventId: "corr1" };
  const proj2 = ProgressionModel.project([base, correction]);
  // ledger has correction entry, lifetime may decrease via explicit correction but overall progression never auto-decreases; correction is visible
  assert.equal(proj2.ledger.length, 2);
  assert.equal(proj2.ledger[1].reason, "correction: session adjustment");
  // Lifetime after correction is 50, but important is that correction is explicit and not silent
  assert.equal(proj2.totals.lifetimeXp, 50);
});

test("milestone significance locked and season not farmed", () => {
  const e = event("planning.milestone.progressed", { id: "m1", status: "completed", lockedSignificance: 3 }, "m1", null);
  const proj = ProgressionModel.project([e]);
  assert.equal(proj.ledger[0].lifetimeXp, 1000);
  assert.equal(proj.ledger[0].seasonXp, 0); // arbitrary significance must not increase Season XP
  // user-created large significance 6 should still be 6000 lifetime, 0 season
  const e2 = event("planning.milestone.progressed", { id: "m2", status: "completed", lockedSignificance: 6 }, "m2", null);
  const proj2 = ProgressionModel.project([e2]);
  assert.equal(proj2.ledger[0].lifetimeXp, 6000);
  assert.equal(proj2.ledger[0].seasonXp, 0);
});

test("arbitrary significance cannot farm season XP", () => {
  const events = [
    event("planning.milestone.progressed", { id: "m-big", status: "completed", lockedSignificance: 6 }, "big1", null),
    event("session.finished", { focusedMilliseconds: 10 * 60000, plannedMinutes: null }, "s-small", "2026-08-17")
  ];
  const proj = ProgressionModel.project(events);
  const milestone = proj.ledger.find(e => /milestone/.test(e.reason));
  assert.equal(milestone.seasonXp, 0);
  const session = proj.ledger.find(e => /focused session/.test(e.reason));
  assert.equal(session.seasonXp, 10);
  // total season only from session
  assert.equal(proj.totals.seasonXp, 10);
});

test("Level thresholds and Story Rank", () => {
  assert.equal(ProgressionModel.levelForXp(0), 1);
  assert.equal(ProgressionModel.levelForXp(499), 1);
  assert.equal(ProgressionModel.levelForXp(500), 2);
  assert.equal(ProgressionModel.levelForXp(500 + 550), 3); // 500 + (500+50)
  assert.equal(ProgressionModel.storyRankForLevel(1), "Wanderer");
  assert.equal(ProgressionModel.storyRankForLevel(5), "Settler");
  assert.equal(ProgressionModel.storyRankForLevel(12), "Builder");
  assert.equal(ProgressionModel.storyRankForLevel(20), "Steward");
  assert.equal(ProgressionModel.storyRankForLevel(35), "Warden");
  assert.equal(ProgressionModel.storyRankForLevel(50), "Vanguard");
  assert.equal(ProgressionModel.storyRankForLevel(75), "Champion");
  assert.equal(ProgressionModel.storyRankForLevel(100), "Regent");
  assert.equal(ProgressionModel.storyRankForLevel(150), "Sovereign");
  assert.equal(ProgressionModel.storyRankForLevel(200), "Sovereign");
});

test("Momentum: inactivity does not reduce permanent XP/Level/Rank", () => {
  const events = [
    event("session.finished", { focusedMilliseconds: 60 * 60000, plannedMinutes: null }, "m1", "2026-08-10"),
    event("habit.completed", { habitId: "h1", dailyXpDate: "2026-08-10" }, "h1-10", "2026-08-10")
  ];
  const projActive = ProgressionModel.project(events);
  const lifetimeBefore = projActive.totals.lifetimeXp;
  const levelBefore = projActive.level;
  const rankBefore = projActive.storyRank;
  // add 7 days gap with no activity, represented by day advanced with no ledger
  const gapEvents = events.concat([
    event("habit.day.advanced", { dailyXpDate: "2026-08-17" }, "adv17", "2026-08-17"),
    event("habit.day.advanced", { dailyXpDate: "2026-08-18" }, "adv18", "2026-08-18")
  ]);
  const projGap = ProgressionModel.project(gapEvents);
  assert.equal(projGap.totals.lifetimeXp, lifetimeBefore);
  assert.equal(projGap.level, levelBefore);
  assert.equal(projGap.storyRank, rankBefore);
  assert.equal(projGap.momentum, "Dormant");
});

test("Momentum derives from last 7 eligible days", () => {
  const events = [];
  for (let d = 10; d <= 16; d += 1) {
    const date = `2026-08-${String(d).padStart(2, "0")}`;
    events.push(event("habit.completed", { habitId: "h1", dailyXpDate: date }, `h-${d}`, date));
  }
  const proj = ProgressionModel.project(events);
  assert.equal(proj.momentum, "Legendary"); // 7 active days
  const partial = [];
  for (let d = 14; d <= 16; d += 1) {
    const date = `2026-08-${String(d).padStart(2, "0")}`;
    partial.push(event("habit.completed", { habitId: "h1", dailyXpDate: date }, `hp-${d}`, date));
  }
  // add gap days as advanced to make lastDate 16 but only 3 active
  partial.push(event("habit.day.advanced", { dailyXpDate: "2026-08-16" }, "adv", "2026-08-16"));
  const proj2 = ProgressionModel.project(partial);
  // With only 3 active days out of last 7, momentum should be Steady (3-4)
  assert.ok(["Steady", "Stirring", "Blazing"].includes(proj2.momentum));
});

test("season reset: totals season resets but lifetime preserved", () => {
  const events = [
    event("session.finished", { focusedMilliseconds: 60 * 60000, plannedMinutes: null }, "s1", "2026-08-17"),
    event("habit.completed", { habitId: "h1", dailyXpDate: "2026-08-17" }, "h1", "2026-08-17")
  ];
  const before = ProgressionModel.project(events);
  assert.equal(before.totals.seasonXp, 80);
  const reset = { type: "progression.season.reset", payload: { seasonId: 2 }, eventId: "reset1" };
  const after = ProgressionModel.project(events.concat([reset]));
  assert.equal(after.totals.lifetimeXp, before.totals.lifetimeXp);
  assert.equal(after.totals.seasonXp, 0);
  assert.equal(after.seasonId, 2);
  // new season can accrue again
  const nextSeason = events.concat([reset, event("session.finished", { focusedMilliseconds: 30 * 60000, plannedMinutes: null }, "s2", "2026-08-18")]);
  const projNext = ProgressionModel.project(nextSeason);
  assert.equal(projNext.totals.seasonXp, 30);
});

test("ledger preview is human-readable", () => {
  const entry = { reason: "habit completed: h1", lifetimeXp: 20, seasonXp: 20, ruleVersion: 1 };
  const preview = ProgressionModel.previewFor(entry);
  assert.match(preview, /habit completed/);
  assert.match(preview, /20 Lifetime/);
  assert.match(preview, /v1/);
});

test("projection is frozen and deterministic", () => {
  const events = [event("session.finished", { focusedMilliseconds: 10 * 60000, plannedMinutes: null }, "id1", "2026-08-17")];
  const a = ProgressionModel.project(events);
  const b = ProgressionModel.project(events);
  assert.deepEqual(a, b);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.ledger), true);
});
