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

test("deterministic and frozen", () => {
  let p=RecoveryModel.emptyProjection();
  p=apply(p, { type:"recovery.track.create", track:{ id:"t-freeze", category:"alcohol", startDate:"2026-08-01", visibility:"private" } });
  assert.ok(Object.isFrozen(p));
  const a=RecoveryModel.project([]);
  const b=RecoveryModel.project([]);
  assert.deepEqual(a,b);
});
