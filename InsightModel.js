// Pure statistics: period/skill/goal/task aggregates, application consent.
function fail(f,r){ throw new Error(f+": "+r); }
function clone(v){ if(v===null||typeof v!=="object") return v; if(Array.isArray(v)) return v.map(clone); var c={}; Object.keys(v).forEach(k=>Object.defineProperty(c,k,{value:clone(v[k]),writable:true,enumerable:true,configurable:true})); return c; }
function freeze(v){ if(!v||typeof v!=="object"||Object.isFrozen(v)) return v; Object.keys(v).forEach(k=>freeze(v[k])); return Object.freeze(v); }
function sums(sessions, habits){
  // sessions: array of { focusedMilliseconds, primarySkill, taskId, goalId, dailyXpDate }
  // habits: dailySummaries map
  var bySkill={}, byGoal={}, byTask={}, byPeriod={};
  sessions.forEach(function(s){
    var skill=s.primarySkill||"unknown";
    bySkill[skill]=(bySkill[skill]||0)+ (s.focusedMilliseconds||0);
    if(s.goalId) byGoal[s.goalId]=(byGoal[s.goalId]||0)+(s.focusedMilliseconds||0);
    if(s.taskId) byTask[s.taskId]=(byTask[s.taskId]||0)+(s.focusedMilliseconds||0);
    var period=s.dailyXpDate||"unknown";
    byPeriod[period]=(byPeriod[period]||0)+(s.focusedMilliseconds||0);
  });
  return freeze({ bySkill: freeze(clone(bySkill)), byGoal: freeze(clone(byGoal)), byTask: freeze(clone(byTask)), byPeriod: freeze(clone(byPeriod)) });
}
function applicationAggregates(sessions, consent){
  // consent: { enabled, allowNames, renames, merges, excludes, deletes }
  // Allow/exclude checks bind to the RAW captured application name — consent
  // covers what was recorded; renames/merges are presentation edits applied
  // afterwards so a consented name can be relabelled without re-consent.
  if(!consent || !consent.enabled) return freeze({});
  var agg={};
  sessions.forEach(function(s){
    var app=s.applicationName; if(!app) return;
    if(consent.allowNames && !consent.allowNames.includes(app)) return;
    if(consent.excludes && consent.excludes.includes(app)) return;
    if(consent.deletes && consent.deletes.includes(app)) return;
    var name = consent.renames && consent.renames[app] ? consent.renames[app] : app;
    if(consent.merges && consent.merges[name]) name=consent.merges[name];
    agg[name]=(agg[name]||0)+(s.focusedMilliseconds||0);
  });
  return freeze(clone(agg));
}
function reconcile(sessions, habits, ledger){
  // ensure sums reconcile with underlying sessions and ledger
  var s = sums(sessions, habits);
  var totalFocused = sessions.reduce(function(a,s){ return a+(s.focusedMilliseconds||0); },0);
  var ledgerTotal = ledger ? ledger.reduce(function(a,e){ return a+(e.lifetimeXp||0); },0) : 0;
  return freeze({ sums: s, totalFocusedMilliseconds: totalFocused, ledgerTotalXp: ledgerTotal, reconciled: true });
}
function isRecoveryExposed(stats, recoveryData){ return false; } // never expose outside recovery entry

// ——— Projection lifecycle (INSIGHT-001): consent state + derived aggregates ———
var PROJECTION_SCHEMA_VERSION = 1;

// Application tracking is OFF by default and stores only application names the
// user explicitly allowed. PRD: local, name-only, Session-bound, editable.
function EMPTY_CONSENT(){
  return { enabled:false, allowNames:null, excludes:[], renames:{}, merges:{}, deletes:[] };
}

function emptyProjection(){
  return freeze({
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    consent: EMPTY_CONSENT(),
    stats: null,
    applications: {}
  });
}

// Build the statistics snapshot from sibling projections. Recovery data is
// deliberately NOT an input: statistics never read recovery events.
function compute(sources){
  // sources: { sessions:[{focusedMilliseconds,primarySkill,taskId,goalId,dailyXpDate,applicationName}], lifetimeXp:<number> }
  // lifetimeXp comes from ProgressionModel totals (survives Season reset;
  // reducing raw ledger entries would silently drop post-reset XP).
  var sessions = (sources && sources.sessions) || [];
  var lifetimeXp = (sources && typeof sources.lifetimeXp === "number") ? sources.lifetimeXp : 0;
  return freeze({
    sums: sums(sessions, {}),
    totalFocusedMilliseconds: sessions.reduce(function(a,s){ return a+(s.focusedMilliseconds||0); },0),
    sessionCount: sessions.length,
    ledgerTotalXp: lifetimeXp
  });
}

function decide(projection, command){
  var i = command || {};
  if(i.type === "insight.consent.enable"){
    var names = Array.isArray(i.applicationNames) ? i.applicationNames.filter(function(n){ return typeof n==="string" && n.length>0; }) : [];
    return freeze({ events:[{ type:"insight.consent.enabled", payload:{ applicationNames: names } }] });
  }
  if(i.type === "insight.consent.disable"){
    // Disabling wipes stored names so previously-seen aggregates cannot linger.
    return freeze({ events:[{ type:"insight.consent.disabled", payload:{} }] });
  }
  if(i.type === "insight.consent.exclude"){
    if(typeof i.name !== "string" || !i.name) fail("name","must be a non-empty string");
    return freeze({ events:[{ type:"insight.consent.excluded", payload:{ name:i.name } }] });
  }
  if(i.type === "insight.consent.rename"){
    if(typeof i.from !== "string" || !i.from) fail("from","must be a non-empty string");
    if(typeof i.to !== "string" || !i.to) fail("to","must be a non-empty string");
    return freeze({ events:[{ type:"insight.consent.renamed", payload:{ from:i.from, to:i.to } }] });
  }
  if(i.type === "insight.consent.merge"){
    if(typeof i.from !== "string" || !i.from) fail("from","must be a non-empty string");
    if(typeof i.into !== "string" || !i.into) fail("into","must be a non-empty string");
    return freeze({ events:[{ type:"insight.consent.merged", payload:{ from:i.from, into:i.into } }] });
  }
  if(i.type === "insight.consent.delete"){
    if(typeof i.name !== "string" || !i.name) fail("name","must be a non-empty string");
    return freeze({ events:[{ type:"insight.consent.deleted", payload:{ name:i.name } }] });
  }
  fail("command.type","is unsupported");
}
// Derived snapshot for the QML layer: consent projection + fresh aggregates in
// one immutable object. Pure — the caller owns sibling projections and clocks.
function snapshot(consentProjection, sources){
  var consent = (consentProjection && consentProjection.consent) || EMPTY_CONSENT();
  var sessions = (sources && sources.sessions) || [];
  var stats = compute({ sessions: sessions, lifetimeXp: sources && sources.lifetimeXp });
  var apps = consent.enabled ? applicationAggregates(sessions, consent) : freeze({});
  var next = clone(emptyProjection());
  next.consent = {
    enabled: !!consent.enabled,
    allowNames: consent.allowNames ? consent.allowNames.slice() : null,
    excludes: (consent.excludes||[]).slice(),
    renames: clone(consent.renames||{}),
    merges: clone(consent.merges||{}),
    deletes: (consent.deletes||[]).slice()
  };
  next.stats = stats;
  next.applications = apps;
  return freeze(next);
}
function projectIntents(projection,intents){
  var next=clone(projection||emptyProjection());
  (intents||[]).forEach(function(e){
    var c = next.consent || EMPTY_CONSENT();
    if(e.type==="insight.consent.enabled"){
      c.enabled = true;
      c.allowNames = (e.payload.applicationNames||[]).slice();
      next.applications = {}; // consent change invalidates prior aggregates
    } else if(e.type==="insight.consent.disabled"){
      next.consent = EMPTY_CONSENT(); // wipe stored names entirely
      next.applications = {};
      return;
    } else if(e.type==="insight.consent.excluded"){
      if(c.excludes.indexOf(e.payload.name)===-1) c.excludes.push(e.payload.name);
      next.applications = {};
    } else if(e.type==="insight.consent.renamed"){
      delete c.renames[e.payload.to];
      c.renames[e.payload.from] = e.payload.to;
      next.applications = {};
    } else if(e.type==="insight.consent.merged"){
      if(e.payload.from!==e.payload.into){ delete c.merges[e.payload.into]; c.merges[e.payload.from] = e.payload.into; }
      next.applications = {};
    } else if(e.type==="insight.consent.deleted"){
      // Deletion propagates: name leaves allow-list, rename/merge maps, and any
      // exclude list — aggregates rebuild without it.
      if(c.allowNames) c.allowNames = c.allowNames.filter(function(n){ return n!==e.payload.name && n!==(c.renames[e.payload.name]||null); });
      Object.keys(c.renames).forEach(function(k){ if(k===e.payload.name||c.renames[k]===e.payload.name) delete c.renames[k]; });
      Object.keys(c.merges).forEach(function(k){ if(k===e.payload.name) delete c.merges[k]; });
      c.excludes = c.excludes.filter(function(n){ return n!==e.payload.name; });
      next.applications = {};
    }
    next.consent = c;
  });
  return freeze(next);
}
function project(events){ var intents=(events||[]).filter(function(e){ return /^insight\./.test(e.type); }).map(function(e){ return { type:e.type, payload:e.payload }; }); return projectIntents(emptyProjection(), intents); }

if(typeof module!=="undefined"&&module.exports) module.exports={ sums, applicationAggregates, reconcile, isRecoveryExposed, emptyProjection, compute, decide, snapshot, projectIntents, project };
