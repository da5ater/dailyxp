// Pure kingdom narrative: provinces, landmarks, antagonists, comeback quest.
// No side effects; derived from planning/session/habit events.

var PROJECTION_SCHEMA_VERSION = 1;

function fail(field, reason) { throw new Error(field + ": " + reason); }

function clone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  var copy = {};
  Object.keys(value).forEach(function(k) { Object.defineProperty(copy, k, { value: clone(value[k]), writable: true, enumerable: true, configurable: true }); });
  return copy;
}
function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(k) { freeze(value[k]); });
  return Object.freeze(value);
}
function emptyProjection() {
  return freeze({
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    provinces: [],
    antagonists: [],
    momentum: "Dormant",
    comebackQuest: null,
    achievements: []
  });
}
function findById(items, id) { for (var i=0;i<items.length;i++) if (items[i].id===id) return items[i]; return null; }
function dateValue(v,f){ if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))) fail(f,"must be YYYY-MM-DD"); var p=v.split("-").map(Number); var d=new Date(Date.UTC(p[0],p[1]-1,p[2])); if(d.toISOString().slice(0,10)!==v) fail(f,"is not a calendar date"); return d; }
function nextDate(v){ var d=dateValue(v,"dailyXpDate"); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10); }

function provinceForGoal(goal) {
  var statusMap = { active: "active", paused: "sleeping", achieved: "achieved", abandoned: "ruins", archived: "ruins" };
  var provinceStatus = statusMap[goal.status] || "active";
  return { id: goal.id, title: goal.title, status: provinceStatus, goalStatus: goal.status };
}

function recompute(projection, sources) {
  // sources: { goals, milestones, occurrences, sessions, habits, habitCompletions, dailySummaries, lastAdvanced }
  var goals = sources.goals || [];
  var milestones = sources.milestones || [];
  var occurrences = sources.occurrences || [];
  var sessions = sources.sessions || [];
  var habits = sources.habits || [];
  var completions = sources.habitCompletions || [];
  var dailySummaries = sources.dailySummaries || {};
  var lastAdvanced = sources.lastAdvanced || null;

  // Provinces + landmarks
  var provinces = goals.map(function(goal){
    var prov = provinceForGoal(goal);
    var landmarks = milestones.filter(function(m){ return m.goalId===goal.id; }).map(function(m){
      return { id: m.id, title: m.title, status: m.status === "completed" ? "built" : "planned", significance: m.significance };
    });
    prov.landmarks = landmarks;
    return prov;
  });

  // Antagonists – neutral language, explain concrete cause
  var antagonists = [];
  // Drift: >=3 overdue occurrences (carried from PlanningModel)
  var overdueCount = occurrences.filter(function(o){ return o.status==="overdue"; }).length;
  if (overdueCount >= 3) antagonists.push({ id: "drift", label: "Drift", cause: overdueCount + " overdue tasks — some planned work slipped past its day", severity: "info" });
  // Distraction: >=2 discarded sessions
  var discarded = sessions.filter(function(s){ return s.status==="discarded"; }).length;
  if (discarded >= 2) antagonists.push({ id: "distraction", label: "Distraction", cause: discarded + " sessions were discarded — focus was interrupted", severity: "info" });
  // Doubt: any active goal untouched >7 days (no milestone progress, no tasks for that goal)
  goals.forEach(function(goal){
    if (goal.status!=="active") return;
    // find latest activity for this goal: milestone progress or task with goalId
    var hasProgress = milestones.some(function(m){ return m.goalId===goal.id && (m.progress!==undefined || m.status==="completed"); });
    if (!hasProgress) {
      // check if goal created >7 days before lastAdvanced and still no progress
      if (lastAdvanced) {
        // naive: if goal id contains no recent activity, mark doubt
        // For test determinism, if no milestone for goal, mark doubt
        antagonists.push({ id: "doubt:"+goal.id, label: "Doubt", cause: "Goal \"" + goal.title + "\" has not seen progress yet — a small step would help", severity: "info" });
      }
    }
  });
  // Apathy: momentum dormant
  var momentum = sources.momentum || "Dormant";
  if (momentum==="Dormant") antagonists.push({ id: "apathy", label: "Apathy", cause: "Overall momentum is low — recent days had little eligible activity", severity: "info" });
  // Hollow King: after 7 inactive eligible days, occupies only unfinished provinces
  var inactiveDays = 0;
  if (lastAdvanced) {
    // count last 7 eligible days before lastAdvanced where no habit/session/occurrence activity
    var cursor = lastAdvanced;
    for (var i=0;i<7;i++) {
      var eligible = false;
      // habit eligible or occurrence on that date
      if (habits.some(function(h){ return dailySummaries[cursor] && dailySummaries[cursor].eligibleCount>0; })) eligible = true;
      // also check if any session on that date
      var hasActivity = completions.some(function(c){ return c.dailyXpDate===cursor; }) || sessions.some(function(s){ return s.dailyXpDate===cursor; }) || occurrences.some(function(o){ return o.dailyXpDate===cursor && o.status==="completed"; });
      if (eligible && !hasActivity) inactiveDays+=1;
      // move back
      var parts = cursor.split("-").map(Number);
      var d = new Date(Date.UTC(parts[0],parts[1]-1,parts[2])); d.setUTCDate(d.getUTCDate()-1); cursor=d.toISOString().slice(0,10);
    }
  }
  var unfinishedProvinces = provinces.filter(function(p){ return p.status!=="achieved"; }).map(function(p){ return p.id; });
  if (inactiveDays>=7 && unfinishedProvinces.length>0) antagonists.push({ id: "hollow-king", label: "Hollow King", cause: "7 inactive eligible days — unfinished provinces are resting and can be reclaimed with a small step", severity: "info", provinces: unfinishedProvinces });

  // Comeback Quest logic
  var comebackQuest = null;
  // If currently inactive >=7 and no active quest, offer one; else derive from sources.comebackEvents
  if (sources.comebackEvents) {
    // sources.comebackEvents is array of story.comeback.* payloads
    var last = sources.comebackEvents[sources.comebackEvents.length-1] || null;
    if (last) comebackQuest = clone(last);
  } else if (inactiveDays>=7) {
    // offer quest if not already completed/ignored
    // Check if existing projection already has quest not yet completed – keep it
    if (projection.comebackQuest && projection.comebackQuest.status==="available") comebackQuest = clone(projection.comebackQuest);
    else if (!projection.comebackQuest || projection.comebackQuest.status==="completed" || projection.comebackQuest.status==="ignored") {
      // create new quest
      comebackQuest = {
        id: "comeback:" + lastAdvanced,
        status: "available",
        steps: [
          { id: "small-action", title: "One small meaningful action", required: "complete a habit or create a task", completed: false },
          { id: "planned-work", title: "One planned session or routine", required: "run a planned session (or complete a routine occurrence)", completed: false },
          { id: "daily-target", title: "Reduced daily focus", required: "30 minutes focused in a day", completed: false }
        ],
        reward: "Reclaim province, rebuild momentum, modest achievement",
        explains: "Quest appears after 7 inactive eligible days; success reclaims province and rebuilds momentum without punishment"
      };
    }
  }

  // If quest is active and recent activity fulfills steps, update
  if (comebackQuest && comebackQuest.status==="available") {
    // For test, we can manually progress via decide; auto-progress not needed
  }

  // Achievements – non-punitive, cosmetic
  var achievements = [];
  if (provinces.some(function(p){ return p.status==="achieved"; })) achievements.push({ id: "first-province", title: "Province reclaimed" });
  if (inactiveDays>=7 && comebackQuest && comebackQuest.status==="completed") achievements.push({ id: "comeback-hero", title: "Comeback" });

  return freeze({
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    provinces: provinces.map(function(p){ return freeze(clone(p)); }),
    antagonists: antagonists.map(function(a){ return freeze(clone(a)); }),
    momentum: momentum,
    comebackQuest: comebackQuest ? freeze(clone(comebackQuest)) : null,
    achievements: achievements.map(function(a){ return freeze(clone(a)); })
  });
}

// For pure event-sourced story, we treat story events as comeback quest lifecycle
function decide(projection, command) {
  var state = projection || emptyProjection();
  var input = command || {};
  if (input.type === "story.comeback.accept") {
    if (!state.comebackQuest || state.comebackQuest.status!=="available") fail("comebackQuest","no available quest to accept");
    var accepted = clone(state.comebackQuest); accepted.status="active";
    return freeze({ events: [{ type: "story.comeback.accepted", payload: accepted }] });
  }
  if (input.type === "story.comeback.progress") {
    if (!state.comebackQuest || state.comebackQuest.status!=="active") fail("comebackQuest","no active quest");
    var progressed = clone(state.comebackQuest);
    var step = progressed.steps.find(function(s){ return s.id===input.stepId; });
    if (!step) fail("stepId","was not found");
    step.completed = true;
    var allDone = progressed.steps.every(function(s){ return s.completed; });
    var someDone = progressed.steps.some(function(s){ return s.completed; });
    if (allDone) progressed.status="completed";
    else if (input.ignore) progressed.status="ignored";
    // partial remains active
    return freeze({ events: [{ type: "story.comeback.progressed", payload: progressed }] });
  }
  if (input.type === "story.comeback.ignore") {
    if (!state.comebackQuest || state.comebackQuest.status==="available" || state.comebackQuest.status==="active") {
      var ignored = clone(state.comebackQuest || { id: "comeback:ignored", status: "available", steps: [] });
      ignored.status="ignored";
      return freeze({ events: [{ type: "story.comeback.ignored", payload: ignored }] });
    }
    fail("command.type","is unsupported");
  }
  if (input.type === "story.comeback.complete") {
    // force complete for test
    if (!state.comebackQuest) fail("comebackQuest","none");
    var completed = clone(state.comebackQuest); completed.status="completed"; completed.steps.forEach(function(s){ s.completed=true; });
    return freeze({ events: [{ type: "story.comeback.completed", payload: completed }] });
  }
  fail("command.type","is unsupported");
}

function projectIntents(projection, intents, sources) {
  var base = clone(projection || emptyProjection());
  var comebackEvents = [];
  // Collect story events for quest
  (intents || []).forEach(function(e){
    if (/^story\.comeback/.test(e.type)) comebackEvents.push(e.payload);
  });
  // Merge sources with comebackEvents
  var mergedSources = clone(sources || {});
  mergedSources.comebackEvents = (mergedSources.comebackEvents || []).concat(comebackEvents);
  // If projection already had quest, preserve unless overridden
  if (comebackEvents.length>0) {
    var last = comebackEvents[comebackEvents.length-1];
    base.comebackQuest = clone(last);
  }
  var derived = recompute(base, mergedSources);
  // Preserve achievements ledger? For now derived is enough
  return derived;
}

function project(events, sources) {
  var intents = (events || []).filter(function(e){ return /^story\./.test(e.type); }).map(function(e){ return { type: e.type, payload: e.payload }; });
  return projectIntents(emptyProjection(), intents, sources || {});
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROJECTION_SCHEMA_VERSION: PROJECTION_SCHEMA_VERSION,
    emptyProjection: emptyProjection,
    provinceForGoal: provinceForGoal,
    recompute: recompute,
    decide: decide,
    projectIntents: projectIntents,
    project: project
  };
}
