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
test("recovery never exposed",()=>{
  assert.equal(Insight.isRecoveryExposed({},{ sensitive:true }),false);
});
test("empty state",()=>{
  const r=Insight.reconcile([],{},[]);
  assert.equal(r.totalFocusedMilliseconds,0);
});
