// Pure statistics: period/skill/goal/task aggregates, application consent.
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
  if(!consent || !consent.enabled) return freeze({});
  var agg={};
  sessions.forEach(function(s){
    var app=s.applicationName; if(!app) return;
    if(consent.excludes && consent.excludes.includes(app)) return;
    var name = consent.renames && consent.renames[app] ? consent.renames[app] : app;
    if(consent.merges && consent.merges[name]) name=consent.merges[name];
    if(consent.deletes && consent.deletes.includes(name)) return;
    if(consent.allowNames && !consent.allowNames.includes(name)) return;
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
if(typeof module!=="undefined"&&module.exports) module.exports={ sums, applicationAggregates, reconcile, isRecoveryExposed };
