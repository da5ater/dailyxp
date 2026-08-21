// Pure UX state: Play/Journey/World surfaces, focused sheets, motion tiers.
var SURFACES = ["Play","Journey","World"];
var MOTION = { micro: [100,180], spatial: [220,420], celebration: [700,1800] };
function fail(f,r){ throw new Error(f+": "+r); }
function clone(v){ if(v===null||typeof v!=="object") return v; if(Array.isArray(v)) return v.map(clone); var c={}; Object.keys(v).forEach(k=>Object.defineProperty(c,k,{value:clone(v[k]),writable:true,enumerable:true,configurable:true})); return c; }
function freeze(v){ if(!v||typeof v!=="object"||Object.isFrozen(v)) return v; Object.keys(v).forEach(k=>freeze(v[k])); return Object.freeze(v); }
function emptyProjection(){ return freeze({ currentSurface:"Play", sheets:[], reducedMotion:false, scale:1, highContrast:false, focusVisible:true }); }
function decide(projection, command){
  var p=projection||emptyProjection();
  var i=command||{};
  if(i.type==="ux.navigate"){ if(SURFACES.indexOf(i.surface)===-1) fail("surface","is invalid"); return freeze({ events:[{ type:"ux.navigated", payload:{ surface:i.surface } }] }); }
  if(i.type==="ux.sheet.open"){ return freeze({ events:[{ type:"ux.sheet.opened", payload:{ sheetId:i.sheetId } }] }); }
  if(i.type==="ux.sheet.close"){ return freeze({ events:[{ type:"ux.sheet.closed", payload:{ sheetId:i.sheetId } }] }); }
  if(i.type==="ux.reducedMotion.set"){ return freeze({ events:[{ type:"ux.reducedMotion.set", payload:{ enabled: !!i.enabled } }] }); }
  if(i.type==="ux.scale.set"){ if(typeof i.scale!=="number"||i.scale<0.5||i.scale>2) fail("scale","must be 0.5-2"); return freeze({ events:[{ type:"ux.scale.set", payload:{ scale:i.scale } }] }); }
  fail("command.type","is unsupported");
}
function projectIntents(projection,intents){
  var next=clone(projection||emptyProjection());
  (intents||[]).forEach(function(e){
    if(e.type==="ux.navigated") next.currentSurface=e.payload.surface;
    else if(e.type==="ux.sheet.opened") { if(next.sheets.indexOf(e.payload.sheetId)===-1) next.sheets.push(e.payload.sheetId); }
    else if(e.type==="ux.sheet.closed") next.sheets=next.sheets.filter(function(s){ return s!==e.payload.sheetId; });
    else if(e.type==="ux.reducedMotion.set") next.reducedMotion=!!e.payload.enabled;
    else if(e.type==="ux.scale.set") next.scale=e.payload.scale;
  });
  return freeze(next);
}
function project(events){ var intents=(events||[]).filter(function(e){ return /^ux\./.test(e.type); }).map(function(e){ return { type:e.type, payload:e.payload }; }); return projectIntents(emptyProjection(), intents); }
if(typeof module!=="undefined"&&module.exports) module.exports={ SURFACES, MOTION, emptyProjection, decide, projectIntents, project };
