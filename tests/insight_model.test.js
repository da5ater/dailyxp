const test=require("node:test"); const assert=require("node:assert/strict"); const Insight=require("../InsightModel.js");
test("period/skill/goal/task aggregates reconcile",()=>{
  const sessions=[{focusedMilliseconds:60000,primarySkill:"backend/study",goalId:"g1",taskId:"t1",dailyXpDate:"2026-08-17"},{focusedMilliseconds:120000,primarySkill:"backend/build",goalId:"g1",taskId:"t2",dailyXpDate:"2026-08-17"}];
  const r=Insight.reconcile(sessions,{},[]);
  assert.equal(r.totalFocusedMilliseconds,180000);
  assert.equal(r.sums.bySkill["backend/study"],60000);
  assert.equal(r.sums.byGoal["g1"],180000);
  assert.equal(r.sums.byTask["t1"],60000);
  assert.equal(r.sums.byPeriod["2026-08-17"],180000);
  assert.equal(r.reconciled,true);
});
test("application consent: disabled, enabled, exclude/rename/merge/delete",()=>{
  const sessions=[{focusedMilliseconds:60000,applicationName:"Code"},{focusedMilliseconds:30000,applicationName:"Chrome"}];
  assert.deepEqual(Insight.applicationAggregates(sessions,{enabled:false}),{});
  assert.deepEqual(Insight.applicationAggregates(sessions,{enabled:true}),{Code:60000,Chrome:30000});
  assert.deepEqual(Insight.applicationAggregates(sessions,{enabled:true,excludes:["Chrome"]}),{Code:60000});
  assert.deepEqual(Insight.applicationAggregates(sessions,{enabled:true,renames:{Code:"VSCode"}}),{VSCode:60000,Chrome:30000});
  assert.deepEqual(Insight.applicationAggregates(sessions,{enabled:true,merges:{"VSCode":"Editor"},renames:{Code:"VSCode"}}),{Editor:60000,Chrome:30000});
  assert.deepEqual(Insight.applicationAggregates(sessions,{enabled:true,deletes:["Code"]}),{Chrome:30000});
});
test("recovery never exposed — even with live recovery projection co-resident",()=>{
  const RecoveryModel=require("../RecoveryModel.js");
  function apply(proj, cmd){ const r=RecoveryModel.decide(proj, cmd); return RecoveryModel.projectIntents(proj, r.events); }
  let rp=RecoveryModel.emptyProjection();
  rp=apply(rp, { type:"recovery.track.create", track:{ id:"t-co", category:"gaming", startDate:"2026-08-01", visibility:"private" } });
  rp=apply(rp, { type:"recovery.checkin", trackId:"t-co", dailyXpDate:"2026-08-04", mood:"low", note:"co-resident" });
  rp=apply(rp, { type:"recovery.relapse", trackId:"t-co", dailyXpDate:"2026-08-05" });

  const sessions=[{focusedMilliseconds:60000,primarySkill:"backend/study"}];
  assert.equal(Insight.isRecoveryExposed({}, rp), false);
  assert.equal(Insight.isRecoveryExposed({ byPeriod:{"2026-08-04":60000} }, rp), false);
  assert.equal(Insight.isRecoveryExposed(Insight.sums(sessions, {}), rp), false);
  assert.equal(Insight.isRecoveryExposed(Insight.reconcile(sessions, {}, []), rp), false);
  assert.doesNotMatch(JSON.stringify(Insight.sums(sessions, {})), /co-resident|relapse/i);
});
test("empty state",()=>{
  const r=Insight.reconcile([],{},[]);
  assert.equal(r.totalFocusedMilliseconds,0);
});
