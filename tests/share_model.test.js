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
