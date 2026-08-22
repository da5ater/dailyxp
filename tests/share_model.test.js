const test=require("node:test"); const assert=require("node:assert/strict"); const Share=require("../ShareModel.js");
test("field inclusion: preview removes fields",()=>{
  const card=Share.createCard("session",{ minutes:30, skill:"backend", recovery:{ secret:true } },{ removeFields:["skill"] });
  assert.equal(card.fields.minutes,30);
  assert.equal(card.fields.skill,undefined);
  assert.equal(card.fields.recovery,undefined);
  const exp=Share.exportCard(card,"save");
  assert.deepEqual(exp.previewedFields,["minutes"]);
});
test("recovery isolated — every ordinary card type strips recovery unconditionally",()=>{
  // Recovery cards require explicit consent (positive gate)
  assert.throws(()=>Share.createCard("recovery",{ milestone:"30 days" },{}),/recoveryConsented/);
  const consented=Share.createCard("recovery",{ milestone:"30 days" },{ recoveryConsented:true });
  assert.equal(consented.fields.milestone,"30 days");
  assert.equal(consented.type,"recovery");

  // Every non-recovery type strips recovery, regardless of removeFields
  const ordinaryTypes=["session","period","skill","progression","goal","habit","season","guild","fixture"];
  for(const type of ordinaryTypes){
    const withoutRemove=Share.createCard(type,{ recovery:{ secret:true, relapseDate:"2026-08-06" } },{});
    assert.equal(withoutRemove.fields.recovery,undefined, type+" must strip recovery");
    const withRemove=Share.createCard(type,{ habit:"Study", recovery:{ secret:true } },{ removeFields:["habit"] });
    assert.equal(withRemove.fields.recovery,undefined, type+" must strip recovery even when removeFields does not name it");
  }
  // Also an ordinary habit card that never mentioned removeFields at all
  const ordinary=Share.createCard("habit",{ habit:"Study", recovery:{ secret:true } },{});
  assert.equal(ordinary.fields.recovery,undefined);
});
test("sample isolated",()=>{
  const card=Share.createCard("season",{ rank:"Gold" },{ sampleMode:true });
  assert.equal(card.sample,true);
  assert.equal(card.sampleLabel,"Sample – fictional data");
  assert.equal(card.isolated,true);
});
test("copy/save/preparePost never auto-post",()=>{
  const card=Share.createCard("session",{ minutes:10 },{});
  assert.equal(Share.exportCard(card,"copy").action,"copy");
  assert.equal(Share.exportCard(card,"preparePost").preparedUrl.includes("card="),true);
  assert.throws(()=>Share.exportCard(card,"autoPost"),/action/);
});
test("projection lifecycle: draft set, field toggle, export journal",()=>{
  function apply(proj,cmd){ const r=Share.decide(proj,cmd); return Share.projectIntents(proj,r.events); }
  let p=Share.emptyProjection();
  assert.equal(p.draft,null);
  p=apply(p,{type:"share.draft.set",cardType:"skill"});
  assert.equal(p.draft.cardType,"skill");
  assert.deepEqual([...p.draft.removeFields],[]);
  // toggle on
  p=apply(p,{type:"share.field.toggled",field:"minutes"});
  assert.ok(p.draft.removeFields.includes("minutes"));
  // toggle off
  p=apply(p,{type:"share.field.toggled",field:"minutes"});
  assert.ok(!p.draft.removeFields.includes("minutes"));
  // recovery drafts rejected — protected flow only
  assert.throws(()=>apply(p,{type:"share.draft.set",cardType:"recovery"}),/protected/);
  // invalid type rejected
  assert.throws(()=>apply(p,{type:"share.draft.set",cardType:"nope"}),/invalid/);
  // export event persists with required fields
  p=apply(p,{type:"share.exported",action:"save",savedPath:"/tmp/card.png",cardId:"card:1",cardType:"skill",previewedFields:["skill"]});
  assert.equal(p.lastExport.action,"save");
  assert.equal(p.lastExport.savedPath,"/tmp/card.png");
  // save without path fails; preparePost needs a known network
  assert.throws(()=>apply(p,{type:"share.exported",action:"save",cardId:"c"}),/savedPath/);
  assert.throws(()=>apply(p,{type:"share.exported",action:"preparePost",network:"gab",cardId:"c"}),/network/);
});
test("fieldsFor derives from sibling projections; recovery and empty sources yield null",()=>{
  const RecoveryModel=require("../RecoveryModel.js");
  let rp=RecoveryModel.emptyProjection();
  rp=RecoveryModel.projectIntents(rp,RecoveryModel.decide(rp,{type:"recovery.track.create",track:{id:"t1",category:"gaming",startDate:"2026-08-01",visibility:"private"}}).events);
  const sources={
    insightProjection:{stats:{sums:{bySkill:{backend:3600000}},totalFocusedMilliseconds:5400000,sessionCount:2}},
    progressionProjection:{totals:{lifetimeXp:4200},level:3},
    sessionProjection:{sessions:[{status:"finished",focusedMilliseconds:3600000,primarySkill:"backend"}]}
  };
  const skill=Share.fieldsFor("skill",sources);
  assert.deepEqual(skill,{skill:"backend",minutes:60});
  const period=Share.fieldsFor("period",sources);
  assert.equal(period.totalFocusedMinutes,90);
  const prog=Share.fieldsFor("progression",sources);
  assert.deepEqual(prog,{level:3,lifetimeXp:4200});
  // recovery is not derivable here at all — structural isolation
  assert.equal(Share.fieldsFor("recovery",{recoveryProjection:rp}),null);
  // fixture/guild have no local source (sample-only)
  assert.equal(Share.fieldsFor("fixture",sources),null);
  assert.equal(Share.fieldsFor("guild",sources),null);
});
test("preparedPostUrl: known networks only, sample labelled, never auto-post",()=>{
  const card=Share.createCard("skill",{skill:"x"},{sampleMode:true});
  assert.ok(Share.preparedPostUrl("x",card).startsWith("https://twitter.com/intent/tweet"));
  assert.ok(Share.preparedPostUrl("linkedin",{}).includes("linkedin.com"));
  assert.ok(Share.preparedPostUrl("facebook",{}).includes("facebook.com"));
  assert.ok(decodeURIComponent(Share.preparedPostUrl("x",card)).includes("fictional data"),"sample cards must carry the fictional label into prepared text");
  assert.throws(()=>Share.preparedPostUrl("mastodon",{}),/network/);
});
