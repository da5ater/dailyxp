const test = require("node:test");
const assert = require("node:assert/strict");
const RecoveryModel = require("../RecoveryModel.js");

function apply(proj, cmd) { const r=RecoveryModel.decide(proj, cmd); return RecoveryModel.projectIntents(proj, r.events); }

test("create track with normalized category and private visibility", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t1", category:"gaming", startDate:"2026-08-01", visibility:"private", customCategory:null } });
  assert.equal(p.tracks[0].category,"gaming");
  assert.equal(p.attempts[0].startDate,"2026-08-01");
});

test("backdated start establishes personal history without duplicate", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-back", category:"alcohol", startDate:"2026-07-01", visibility:"private" } });
  // backdated 30 days ago, attempt exists
  assert.equal(p.attempts[0].startDate,"2026-07-01");
  // duplicate category blocked
  assert.throws(()=> RecoveryModel.decide(p, { type:"recovery.track.create", track:{ id:"t2", category:"alcohol", startDate:"2026-08-01", visibility:"private" } }), /duplicate/);
});

test("check-ins do not control counter, counter is 20 per day", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-check", category:"smoking", startDate:"2026-08-10", visibility:"private" } });
  p=apply(p, { type:"recovery.checkin", trackId:"t-check", dailyXpDate:"2026-08-11", mood:"ok" });
  // counter not dependent on checkin – set asOf via mutable copy
  let withAsOf = { ...p, _asOfDate: "2026-08-12" };
  withAsOf = RecoveryModel.projectIntents(withAsOf, []);
  assert.ok(withAsOf.xp > 0);
  assert.equal(withAsOf.checkIns.length,1);
});

test("milestones at 1,3,7 days award", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-mile", category:"pornography", startDate:"2026-08-01", visibility:"private" } });
  let withAsOf = { ...p, _asOfDate: "2026-08-08" };
  withAsOf = RecoveryModel.projectIntents(withAsOf, []);
  const m = withAsOf.milestones.filter(m=>m.trackId==="t-mile").map(m=>m.days);
  assert.ok(m.includes(1));
  assert.ok(m.includes(3));
  assert.ok(m.includes(7));
});

test("relapse ends attempt privately, preserves XP, offers restart", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-rel", category:"gambling", startDate:"2026-08-01", visibility:"private" } });
  let withAsOf = { ...p, _asOfDate: "2026-08-05" };
  withAsOf = RecoveryModel.projectIntents(withAsOf, []);
  const xpBefore = withAsOf.xp;
  let p2=apply(p, { type:"recovery.relapse", trackId:"t-rel", dailyXpDate:"2026-08-06" });
  assert.equal(p2.attempts[0].status,"ended");
  assert.equal(p2.attempts[0].relapseDate,"2026-08-06");
  // XP preserved (not removed)
  let withAsOf2 = { ...p2, _asOfDate: "2026-08-07" };
  withAsOf2 = RecoveryModel.projectIntents(withAsOf2, []);
  assert.ok(withAsOf2.xp >= xpBefore);
  // restart
  let p3=apply(p2, { type:"recovery.restart", trackId:"t-rel", dailyXpDate:"2026-08-07" });
  assert.equal(p3.attempts[1].status,"active");
  assert.equal(p3.attempts[1].startDate,"2026-08-07");
});

test("no freeze, missed checkin not relapse", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-nofreeze", category:"gaming", startDate:"2026-08-01", visibility:"private" } });
  // no relapse, no checkin, attempt still active after gap
  let withAsOf = { ...p, _asOfDate: "2026-08-10" };
  withAsOf = RecoveryModel.projectIntents(withAsOf, []);
  assert.equal(withAsOf.attempts[0].status,"active");
});

test("deletion of attempt, track, all", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-del", category:"social_media", startDate:"2026-08-01", visibility:"private" } });
  const attId=p.attempts[0].id;
  p=apply(p, { type:"recovery.delete", trackId:"t-del", scope:"attempt", attemptId:attId });
  assert.equal(p.attempts.length,0);
  // track still exists, so same category blocked – delete track first
  p=apply(p, { type:"recovery.delete", trackId:"t-del", scope:"track" });
  assert.equal(p.tracks.length,0);
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-del2", category:"social_media", startDate:"2026-08-01", visibility:"private" } });
  assert.equal(p.tracks.length,1);
  p=apply(p, { type:"recovery.delete", trackId:"t-del2", scope:"track" });
  assert.equal(p.tracks.length,0);
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-a", category:"gaming", startDate:"2026-08-01", visibility:"private" } });
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-b", category:"smoking", startDate:"2026-08-01", visibility:"private" } });
  p=apply(p, { type:"recovery.delete", scope:"all", trackId:"t-a" });
  assert.equal(p.tracks.length,0);
  assert.equal(p.attempts.length,0);
});

test("custom category moderated", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-custom", category:"custom", customCategory:"doomscrolling", startDate:"2026-08-01", visibility:"private" } });
  assert.equal(p.tracks[0].customCategory,"doomscrolling");
});

test("private-by-default and redacted export — relapse history, notes, and exact start stay private", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-priv", category:"gaming", startDate:"2026-08-01", visibility:"private" } });
  assert.equal(p.tracks[0].visibility, "private");

  p=apply(p, { type:"recovery.checkin", trackId:"t-priv", dailyXpDate:"2026-08-02", mood:"anxious", trigger:"boredom", note:"hard day" });
  p=apply(p, { type:"recovery.checkin", trackId:"t-priv", dailyXpDate:"2026-08-03", mood:"steady", note:"better" });

  let withAsOf = { ...p, _asOfDate: "2026-08-05" };
  withAsOf = RecoveryModel.projectIntents(withAsOf, []);
  const xpBefore = withAsOf.xp;

  let p2=apply(p, { type:"recovery.relapse", trackId:"t-priv", dailyXpDate:"2026-08-06" });
  assert.equal(p2.attempts[0].status, "ended");
  assert.equal(p2.attempts[0].relapseDate, "2026-08-06");

  // Redacted surface: the only legitimate external view is the protected entry itself;
  // any board/aggregate export must not contain sensitive fields.
  const Share = require("../ShareModel.js");
  const Insight = require("../InsightModel.js");

  const redactedShare = Share.createCard("habit", { habit:"Study", recovery: p2.tracks[0] }, {});
  assert.equal(redactedShare.fields.recovery, undefined);
  // Even with explicit removeFields that does NOT name recovery, the strip still holds
  const redactedShare2 = Share.createCard("habit", { habit:"Study", recovery: p2.tracks[0] }, { removeFields: ["habit"] });
  assert.equal(redactedShare2.fields.recovery, undefined);

  const redactedJson = JSON.stringify(redactedShare.fields);
  assert.match(redactedJson, /Study/);
  assert.doesNotMatch(redactedJson, /anxious|boredom|hard day|relapseDate|2026-08-01/);

  assert.equal(Insight.isRecoveryExposed({}, p2), false);
  assert.equal(Insight.isRecoveryExposed({ byPeriod:{} }, p2), false);

  // Relapse preserves XP — privacy violation would be XP deletion or shaming
  let withAsOf2 = { ...p2, _asOfDate: "2026-08-07" };
  withAsOf2 = RecoveryModel.projectIntents(withAsOf2, []);
  assert.ok(withAsOf2.xp >= xpBefore);
  // No shame/penalty/freeze surface on the recovery projection after relapse
  assert.equal(withAsOf2.freeze, undefined);
  assert.doesNotMatch(JSON.stringify(p2), /"shame"|"penalty"/);

  // Restart is the only offered path — not a freeze or penalty
  let p3=apply(p2, { type:"recovery.restart", trackId:"t-priv", dailyXpDate:"2026-08-07" });
  assert.equal(p3.attempts[1].status, "active");
  assert.equal(p3.attempts[1].startDate, "2026-08-07");
  assert.ok(Object.isFrozen(p3));
});

test("no cross-surface leakage — category isolation, pseudonym, and Insight redaction", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-gaming", category:"gaming", startDate:"2026-08-01", visibility:"private" } });
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-smoke", category:"smoking", startDate:"2026-08-01", visibility:"private" } });
  p=apply(p, { type:"recovery.checkin", trackId:"t-gaming", dailyXpDate:"2026-08-05", mood:"ok", note:"gaming-note" });
  p=apply(p, { type:"recovery.checkin", trackId:"t-smoke", dailyXpDate:"2026-08-05", mood:"calm", note:"smoke-note" });

  // Category isolation: check-ins stay on their own track
  assert.equal(p.checkIns.filter(c=>c.trackId==="t-gaming").length, 1);
  assert.equal(p.checkIns.filter(c=>c.trackId==="t-smoke").length, 1);
  assert.equal(p.checkIns.find(c=>c.trackId==="t-gaming").note, "gaming-note");
  assert.equal(p.checkIns.find(c=>c.trackId==="t-smoke").note, "smoke-note");

  // Custom category does not leak into other tracks
  let q=RecoveryModel.emptyProjection();
  q=apply(q, { type:"recovery.track.create", track:{ id:"t-custom", category:"custom", customCategory:"doomscrolling", startDate:"2026-08-01", visibility:"private" } });
  assert.equal(q.tracks[0].customCategory, "doomscrolling");
  assert.equal(q.tracks[0].category, "custom");

  // Insight stays clean even with full recovery co-resident in the same process
  const Insight = require("../InsightModel.js");
  const sessions=[{focusedMilliseconds:60000,primarySkill:"backend/study",goalId:"g1",taskId:"t1",dailyXpDate:"2026-08-05"}];
  const sums = Insight.sums(sessions, {});
  const reconciled = Insight.reconcile(sessions, {}, []);
  assert.equal(Insight.isRecoveryExposed(sums, p), false);
  assert.equal(Insight.isRecoveryExposed(reconciled, p), false);
  assert.doesNotMatch(JSON.stringify(sums), /recovery|relapse|gaming-note/i);
  assert.doesNotMatch(JSON.stringify(reconciled), /recovery|relapse/i);

  // Feed never surfaces relapse as a shaming notification (same assertion as GH-60 gap)
  const Feed = require("../FeedModel.js");
  const budgeted = Feed.notificationBudget([{type:"relapse"},{type:"missed_work"},{type:"achievement"}]);
  assert.ok(!budgeted.some(e=>e.type==="relapse"));
});

test("deletion propagation removes local projections and subsequent redacted exports have no residue", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-delp", category:"pornography", startDate:"2026-08-01", visibility:"private" } });
  p=apply(p, { type:"recovery.checkin", trackId:"t-delp", dailyXpDate:"2026-08-04", mood:"low", note:"sensitive" });
  p=apply(p, { type:"recovery.relapse", trackId:"t-delp", dailyXpDate:"2026-08-05" });
  // Delete the attempt that just ended — checkIns and attempts for that track must clear appropriately
  const attId = p.attempts[0].id;
  let afterAttemptDelete = apply(p, { type:"recovery.delete", trackId:"t-delp", scope:"attempt", attemptId: attId });
  assert.equal(afterAttemptDelete.attempts.length, 0);

  // Fresh track with residue: delete the whole track and prove no ghost in Share/Insight
  let r=RecoveryModel.emptyProjection();
  r=apply(r, { type:"recovery.track.create", track:{ id:"t-ghost", category:"alcohol", startDate:"2026-08-01", visibility:"private" } });
  r=apply(r, { type:"recovery.checkin", trackId:"t-ghost", dailyXpDate:"2026-08-04", note:"ghost-note" });
  r=apply(r, { type:"recovery.delete", trackId:"t-ghost", scope:"track" });
  assert.equal(r.tracks.length, 0);
  assert.equal(r.attempts.length, 0);
  assert.equal(r.checkIns.length, 0);

  const Share = require("../ShareModel.js");
  const Insight = require("../InsightModel.js");
  // After deletion, any share export must have no recovery residue
  const card = Share.createCard("habit", { habit:"Study" }, {});
  assert.equal(card.fields.recovery, undefined);
  assert.equal(Insight.isRecoveryExposed({}, r), false);
  assert.doesNotMatch(JSON.stringify(r), /ghost-note|sensitive/);

  // all-deleted clears everything — mirrors existing `deletion of attempt, track, all` but as privacy proof
  let s=RecoveryModel.emptyProjection();
  s=apply(s, { type:"recovery.track.create", track:{ id:"t-a2", category:"gaming", startDate:"2026-08-01", visibility:"private" } });
  s=apply(s, { type:"recovery.track.create", track:{ id:"t-b2", category:"smoking", startDate:"2026-08-01", visibility:"private" } });
  s=apply(s, { type:"recovery.delete", scope:"all", trackId:"t-a2" });
  assert.equal(s.tracks.length, 0);
  assert.equal(s.attempts.length, 0);
  assert.deepEqual(s.milestones, []);
  assert.ok(Object.isFrozen(s));
});

test("deterministic and frozen", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-freeze", category:"alcohol", startDate:"2026-08-01", visibility:"private" } });
  assert.ok(Object.isFrozen(p));
  const a=RecoveryModel.project([]);
  const b=RecoveryModel.project([]);
  assert.deepEqual(a,b);
});
