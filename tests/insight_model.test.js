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
test("projection lifecycle: consent enable/disable round-trip",()=>{
  let p=Insight.emptyProjection();
  assert.equal(p.consent.enabled,false);
  function apply(proj,cmd){ const r=Insight.decide(proj,cmd); return Insight.projectIntents(proj,r.events); }
  p=apply(p,{type:"insight.consent.enable",applicationNames:["Code","Chrome"]});
  assert.equal(p.consent.enabled,true);
  assert.deepEqual([...p.consent.allowNames].sort(),["Chrome","Code"]);
  p=apply(p,{type:"insight.consent.disable"});
  assert.equal(p.consent.enabled,false);
  assert.equal(p.consent.allowNames,null,"disable must wipe stored names");
});
test("projection lifecycle: exclude/rename/merge/delete propagate",()=>{
  function apply(proj,cmd){ const r=Insight.decide(proj,cmd); return Insight.projectIntents(proj,r.events); }
  let p=apply(Insight.emptyProjection(),{type:"insight.consent.enable",applicationNames:["Code","Chrome","Firefox"]});
  p=apply(p,{type:"insight.consent.exclude",name:"Firefox"});
  assert.ok(p.consent.excludes.includes("Firefox"));
  p=apply(p,{type:"insight.consent.rename",from:"Code",to:"VSCode"});
  assert.equal(p.consent.renames["Code"],"VSCode");
  p=apply(p,{type:"insight.consent.merge",from:"VSCode",into:"Editor"});
  assert.equal(p.consent.merges["VSCode"],"Editor");
  // aggregates honour the full consent chain
  const sessions=[{focusedMilliseconds:60000,applicationName:"Code"},{focusedMilliseconds:30000,applicationName:"Chrome"},{focusedMilliseconds:10000,applicationName:"Firefox"}];
  const agg=Insight.applicationAggregates(sessions,p.consent);
  assert.deepEqual(agg,{Editor:60000,Chrome:30000},"renamed+merged Code lands under Editor; excluded Firefox drops");
  p=apply(p,{type:"insight.consent.delete",name:"Chrome"});
  const agg2=Insight.applicationAggregates(sessions,p.consent);
  assert.equal(agg2.Chrome,undefined,"deleted name must vanish from aggregates");
});
test("snapshot derives stats+applications in one immutable object; recovery never an input",()=>{
  const RecoveryModel=require("../RecoveryModel.js");
  let rp=RecoveryModel.emptyProjection();
  rp=RecoveryModel.projectIntents(rp,RecoveryModel.decide(rp,{type:"recovery.track.create",track:{id:"t1",category:"gaming",startDate:"2026-08-01",visibility:"private"}}).events);
  const sessions=[{focusedMilliseconds:90000,primarySkill:"backend/study",taskId:"t9",goalId:"g1",dailyXpDate:"2026-08-20",applicationName:"Code"}];
  let consentP=Insight.projectIntents(Insight.emptyProjection(),[{type:"insight.consent.enabled",payload:{applicationNames:["Code"]}}]);
  const snap=Insight.snapshot(consentP,{sessions,lifetimeXp:4200});
  assert.equal(snap.stats.totalFocusedMilliseconds,90000);
  assert.equal(snap.stats.ledgerTotalXp,4200);
  assert.equal(snap.applications["Code"],90000);
  assert.equal(JSON.stringify(Object.keys(snap)).includes("recovery"),false);
  assert.doesNotMatch(JSON.stringify(snap),/t1|gaming|2026-08-01/,"recovery track data must not leak into insight snapshot");
  assert.ok(Object.isFrozen(snap));
});
