// Bounded sound and notifications: categories, quiet hours, profiles, budgets.
function clone(v){ if(v===null||typeof v!=="object") return v; if(Array.isArray(v)) return v.map(clone); var c={}; Object.keys(v).forEach(k=>Object.defineProperty(c,k,{value:clone(v[k]),writable:true,enumerable:true,configurable:true})); return c; }
function freeze(v){ if(!v||typeof v!=="object"||Object.isFrozen(v)) return v; Object.keys(v).forEach(k=>freeze(v[k])); return Object.freeze(v); }
var SOUNDS=["start","pause","completion","xp","achievement","level","match_victory"];
var CATEGORIES=["xp","achievement","level","match","reminder","rank"];
var PROFILES={ Focused:{master:0.3}, Adventurous:{master:0.8}, Quiet:{master:0.1} };
function shouldPlay(settings, event, atHour){
  if(!settings) return false;
  if(settings.masterVolume===0) return false;
  if(settings.quietHours && atHour>=settings.quietHours.start && atHour<settings.quietHours.end) return false;
  if(settings.categoryVolumes && settings.categoryVolumes[event.category]===0) return false;
  if(settings.reducedMotion && event.needsMotion) return false;
  // visual equivalent always remains (accessibility)
  return true;
}
function notificationBudget(events, now){
  // one upcoming and one ending reminder, bundled rank, rate-limited, no guilt
  var upcoming = events.filter(function(e){ return e.type==="reminder.upcoming"; }).slice(0,1);
  var ending = events.filter(function(e){ return e.type==="reminder.ending"; }).slice(0,1);
  var achievements = events.filter(function(e){ return e.type==="achievement"; });
  var rankChanges = events.filter(function(e){ return e.type==="rank_change"; });
  var bundledRank = rankChanges.length>0 ? [{ type:"rank_change", count: rankChanges.length, bundled:true }] : [];
  var filtered = [].concat(upcoming, ending, achievements, bundledRank);
  // no guilt notifications for relapse/missed
  return filtered.filter(function(e){ return e.type!=="relapse" && e.type!=="missed_work"; });
}
if(typeof module!=="undefined"&&module.exports) module.exports={ SOUNDS, CATEGORIES, PROFILES, shouldPlay, notificationBudget };
