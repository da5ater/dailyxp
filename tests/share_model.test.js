const test=require("node:test"); const assert=require("node:assert/strict"); const Share=require("../ShareModel.js");
test("field inclusion: preview removes fields",()=>{
  const card=Share.createCard("session",{ minutes:30, skill:"backend", recovery:{ secret:true } },{ removeFields:["skill"] });
  assert.equal(card.fields.minutes,30);
  assert.equal(card.fields.skill,undefined);
  assert.equal(card.fields.recovery,undefined);
  const exp=Share.exportCard(card,"save");
  assert.deepEqual(exp.previewedFields,["minutes"]);
});
test("recovery isolated",()=>{
  assert.throws(()=>Share.createCard("recovery",{ milestone:"30 days" },{}),/recoveryConsented/);
  const card=Share.createCard("recovery",{ milestone:"30 days" },{ recoveryConsented:true });
  assert.equal(card.fields.milestone,"30 days");
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
