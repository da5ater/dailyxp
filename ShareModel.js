// Share cards: preview with field removal, save/copy, no auto-post, recovery isolated.
function clone(v){ if(v===null||typeof v!=="object") return v; if(Array.isArray(v)) return v.map(clone); var c={}; Object.keys(v).forEach(k=>Object.defineProperty(c,k,{value:clone(v[k]),writable:true,enumerable:true,configurable:true})); return c; }
function freeze(v){ if(!v||typeof v!=="object"||Object.isFrozen(v)) return v; Object.keys(v).forEach(k=>freeze(v[k])); return Object.freeze(v); }
var CARD_TYPES=["session","period","skill","progression","goal","habit","recovery","fixture","season","guild"];
function createCard(type, data, options){
  if(CARD_TYPES.indexOf(type)===-1) throw new Error("cardType: is invalid");
  var fields=clone(data||{});
  var opts=options||{};
  // preview: remove every field if requested
  var previewFields=clone(fields);
  if(opts.removeFields) opts.removeFields.forEach(function(f){ delete previewFields[f]; });
  // recovery isolated: ordinary cards never include recovery unless type is recovery and explicitly consented
  if(type!=="recovery" && previewFields.recovery) delete previewFields.recovery;
  if(type==="recovery" && !opts.recoveryConsented) throw new Error("recoveryConsented: is required for recovery cards");
  // sample mode fictional isolated
  var card={ id: opts.cardId||"card:"+Date.now(), type: type, fields: freeze(previewFields), branding: "DailyXP", sample: !!opts.sampleMode, sampleLabel: opts.sampleMode ? "Sample – fictional data" : null };
  if(opts.sampleMode) card.isolated=true;
  return freeze(card);
}
function exportCard(card, action){
  // action: save, copy, preparePost (x, linkedin, facebook)
  if(!card) throw new Error("card: is required");
  if(EXPORT_ACTIONS.indexOf(action)===-1) throw new Error("action: is invalid");
  // never auto-post — preparePost yields a prepared URL the person opens
  // themselves (legacy single-call shape; the panel uses preparedPostUrl with
  // an explicit network for the real links).
  var preparedUrl = action==="preparePost" ? "https://example.com/post?card="+encodeURIComponent(card.id) : null;
  return freeze({ cardId: card.id, action: action, previewedFields: Object.keys(card.fields), preparedUrl: preparedUrl });
}
// Prepared-post URLs open in the person's browser pre-filled; nothing sends.
function preparedPostUrl(network, card){
  if(POST_NETWORKS.indexOf(network)===-1) throw new Error("network: must be x, linkedin, or facebook");
  var text=card && card.sample===true
    ? "My DailyXP progress (sample card – fictional data)"
    : "My DailyXP progress";
  if(network==="x") return "https://twitter.com/intent/tweet?text="+encodeURIComponent(text);
  if(network==="linkedin") return "https://www.linkedin.com/shareArticle?mini=true&summary="+encodeURIComponent(text);
  return "https://www.facebook.com/sharer/sharer.php?u="+encodeURIComponent("https://dailyxp.local/card/"+(card?encodeURIComponent(card.id):""));
}
if(typeof module!=="undefined"&&module.exports) module.exports={ CARD_TYPES, createCard, exportCard, preparedPostUrl, emptyProjection, fieldsFor, decide, projectIntents, project };

// ——— Projection lifecycle (SHARE-001): draft state + export actions ———
var PROJECTION_SCHEMA_VERSION = 1;
var EXPORT_ACTIONS=["save","copy","preparePost"];
var POST_NETWORKS=["x","linkedin","facebook"];

function emptyProjection(){
  return freeze({
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    draft: null,          // { cardType, removeFields:[], sampleMode } — user-editable shape
    lastExport: null      // { cardId, action, network?, preparedUrl? }
  });
}

function fail(f,r){ throw new Error(f+": "+r); }

// Build the field data for a card from sibling projections. Recovery data is
// deliberately NOT an input here — recovery cards go through the protected
// flow in the Recovery surface, never this general share path.
function fieldsFor(type, sources){
  var s=sources||{};
  switch(type){
    case "session": {
      var sessions=(s.sessionProjection&&s.sessionProjection.sessions)||[];
      var finished=null;
      for(var i=sessions.length-1;i>=0;i-=1) if(sessions[i].status==="finished"){ finished=sessions[i]; break; }
      if(!finished) return null;
      return { minutes: Math.round((finished.focusedMilliseconds||0)/60000), skill: finished.primarySkill||null };
    }
    case "period": case "skill": {
      var st=s.insightProjection&&s.insightProjection.stats;
      if(!st) return null;
      if(type==="skill"){
        var keys=Object.keys(st.sums.bySkill);
        if(keys.length===0) return null;
        var best=keys[0];
        keys.forEach(function(k){ if(st.sums.bySkill[k]>st.sums.bySkill[best]) best=k; });
        return { skill: best, minutes: Math.round(st.sums.bySkill[best]/60000) };
      }
      return { totalFocusedMinutes: Math.round((st.totalFocusedMilliseconds||0)/60000), sessions: st.sessionCount||0 };
    }
    case "progression": {
      var p=s.progressionProjection; if(!p||!p.totals) return null;
      return { level: p.level||1, lifetimeXp: p.totals.lifetimeXp||0 };
    }
    case "goal": {
      var goals=(s.planningProjection&&s.planningProjection.goals)||[];
      if(goals.length===0) return null;
      return { title: goals[0].title, status: goals[0].status||"open" };
    }
    case "habit": {
      var habits=(s.habitProjection&&s.habitProjection.habits)||[];
      if(habits.length===0) return null;
      return { title: habits[0].title, streak: habits[0].streak||0 };
    }
    // fixture/guild have no local data source — sample mode only (honest).
    case "fixture": case "guild": return null;
    default: return null;
  }
}

// Commands produce journal events only for durable intent (draft + exports).
// The QML layer renders the preview and grabs the image itself.
function decide(projection, command){
  var i=command||{};
  if(i.type==="share.draft.set"){
    if(CARD_TYPES.indexOf(i.cardType)===-1) fail("cardType","is invalid");
    if(i.cardType==="recovery") fail("cardType","recovery cards use the protected Recovery flow");
    var rf=Array.isArray(i.removeFields)?i.removeFields.filter(function(f){return typeof f==="string";}):[];
    return freeze({ events:[{ type:"share.draft.set", payload:{ cardType:i.cardType, removeFields:rf, sampleMode:!!i.sampleMode } }] });
  }
  if(i.type==="share.field.toggled"){
    if(typeof i.field!=="string"||!i.field) fail("field","must be a non-empty string");
    var d=(projection&&projection.draft)||null;
    if(!d) fail("draft","must exist before toggling fields");
    var next=d.removeFields.indexOf(i.field)===-1
      ? d.removeFields.concat([i.field])
      : d.removeFields.filter(function(f){ return f!==i.field; });
    return freeze({ events:[{ type:"share.draft.set", payload:{ cardType:d.cardType, removeFields:next, sampleMode:d.sampleMode } }] });
  }
  if(i.type==="share.exported"){
    if(EXPORT_ACTIONS.indexOf(i.action)===-1) fail("action","is invalid");
    if(i.action==="save"&&!i.savedPath) fail("savedPath","is required for save exports");
    if(i.action==="preparePost"&&POST_NETWORKS.indexOf(i.network)===-1) fail("network","must be x, linkedin, or facebook");
    return freeze({ events:[{ type:"share.exported", payload:{
      cardId:i.cardId, cardType:i.cardType, action:i.action,
      network:i.network||null, savedPath:i.savedPath||null,
      previewedFields:(Array.isArray(i.previewedFields)?i.previewedFields:[]).slice(),
      sampleMode:!!i.sampleMode } }] });
  }
  fail("command.type","is unsupported");
}
function projectIntents(projection,intents){
  var next=clone(projection||emptyProjection());
  (intents||[]).forEach(function(e){
    if(e.type==="share.draft.set"){
      next.draft=freeze({ cardType:e.payload.cardType, removeFields:(e.payload.removeFields||[]).slice(), sampleMode:!!e.payload.sampleMode });
    } else if(e.type==="share.exported"){
      next.lastExport=freeze(clone(e.payload));
    }
  });
  return freeze(next);
}
function project(events){ var intents=(events||[]).filter(function(e){ return /^share\./.test(e.type); }).map(function(e){ return { type:e.type, payload:e.payload }; }); return projectIntents(emptyProjection(), intents); }


