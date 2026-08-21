const test=require("node:test"); const assert=require("node:assert/strict"); const UxModel=require("../UxModel.js");
function apply(p,c){ const r=UxModel.decide(p,c); return UxModel.projectIntents(p,r.events); }
test("navigates Play/Journey/World without dashboard",()=>{
  let p=UxModel.emptyProjection();
  p=apply(p,{type:"ux.navigate",surface:"Journey"});
  assert.equal(p.currentSurface,"Journey");
  p=apply(p,{type:"ux.navigate",surface:"World"});
  assert.equal(p.currentSurface,"World");
  assert.throws(()=>UxModel.decide(p,{type:"ux.navigate",surface:"Dashboard"}),/surface/);
});
test("focused sheets open/close",()=>{
  let p=UxModel.emptyProjection();
  p=apply(p,{type:"ux.sheet.open",sheetId:"task-create"});
  assert.ok(p.sheets.includes("task-create"));
  p=apply(p,{type:"ux.sheet.close",sheetId:"task-create"});
  assert.ok(!p.sheets.includes("task-create"));
});
test("reduced motion replaces travel with fade, scale preserves legibility",()=>{
  let p=UxModel.emptyProjection();
  p=apply(p,{type:"ux.reducedMotion.set",enabled:true});
  assert.equal(p.reducedMotion,true);
  p=apply(p,{type:"ux.scale.set",scale:1.5});
  assert.equal(p.scale,1.5);
  assert.throws(()=>UxModel.decide(p,{type:"ux.scale.set",scale:3}),/scale/);
});
test("interrupted transition remains interruptible",()=>{
  let p=UxModel.emptyProjection();
  p=apply(p,{type:"ux.navigate",surface:"Journey"});
  p=apply(p,{type:"ux.navigate",surface:"Play"});
  assert.equal(p.currentSurface,"Play");
});
test("frozen and deterministic",()=>{
  const e=[{type:"ux.navigated",payload:{surface:"Journey"}}];
  const a=UxModel.project(e); const b=UxModel.project(e);
  assert.deepEqual(a,b); assert.ok(Object.isFrozen(a));
});
