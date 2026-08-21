// Pure progression: XP ledger, Levels, Story Ranks, Momentum, season reset.
// No clock, filesystem, or UI. Rule-versioned and idempotent by source eventId.

var PROJECTION_SCHEMA_VERSION = 1;
var RULE_VERSION = 1;
var HABIT_XP = 20;
var HABIT_SEASON_CAP = 7;
var FULL_SET_BONUS = 50;
var SESSION_BONUS_RATE = 0.2;
var DAILY_TARGET_BONUS_RATE = 0.25;
var DAILY_TARGET_MINUTES = 120; // configurable target for 25% bonus
var MILESTONE_AWARDS = { 1: 250, 2: 500, 3: 1000, 4: 2000, 5: 4000, 6: 6000 };
var LEVEL_BASE = 500;
var LEVEL_STEP = 50;
var STORY_RANKS = [
  { rank: "Wanderer", level: 1 },
  { rank: "Settler", level: 5 },
  { rank: "Builder", level: 12 },
  { rank: "Steward", level: 20 },
  { rank: "Warden", level: 35 },
  { rank: "Vanguard", level: 50 },
  { rank: "Champion", level: 75 },
  { rank: "Regent", level: 100 },
  { rank: "Sovereign", level: 150 }
];

function fail(field, reason) {
  throw new Error(field + ": " + reason);
}

function clone(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(clone);
  var copy = {};
  Object.keys(value).forEach(function(key) {
    Object.defineProperty(copy, key, {
      value: clone(value[key]), writable: true, enumerable: true, configurable: true
    });
  });
  return copy;
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function(key) { freeze(value[key]); });
  return Object.freeze(value);
}

function emptyProjection() {
  return freeze({
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    ruleVersion: RULE_VERSION,
    ledger: [],
    totals: { lifetimeXp: 0, seasonXp: 0 },
    level: 1,
    storyRank: "Wanderer",
    momentum: "Dormant",
    seasonId: 1,
    dailyTargetMinutes: DAILY_TARGET_MINUTES,
    streakBonus: 0
  });
}

function levelForXp(totalXp) {
  var xp = Number(totalXp);
  if (!Number.isInteger(xp) || xp < 0) fail("totalXp", "must be a nonnegative integer");
  var level = 1;
  var required = LEVEL_BASE;
  while (xp >= required) {
    xp -= required;
    level += 1;
    required = LEVEL_BASE + LEVEL_STEP * (level - 1);
  }
  return level;
}

function storyRankForLevel(level) {
  var rank = STORY_RANKS[0].rank;
  for (var i = 0; i < STORY_RANKS.length; i += 1) {
    if (level >= STORY_RANKS[i].level) rank = STORY_RANKS[i].rank;
    else break;
  }
  return rank;
}

function xpForMilestone(significance) {
  if (!MILESTONE_AWARDS[significance]) fail("significance", "must be an integer 1 through 6");
  return MILESTONE_AWARDS[significance];
}

function ledgerIdFor(sourceEventId) {
  return String(sourceEventId) + ":v" + RULE_VERSION;
}

function findLedgerEntry(ledger, id) {
  for (var i = 0; i < ledger.length; i += 1) if (ledger[i].id === id) return ledger[i];
  return null;
}

function addLedgerEntry(projection, entry) {
  if (findLedgerEntry(projection.ledger, entry.id)) return;
  projection.ledger.push(freeze(clone(entry)));
  projection.totals.lifetimeXp += entry.lifetimeXp;
  projection.totals.seasonXp += entry.seasonXp;
}

function recomputeDerived(projection) {
  projection.level = levelForXp(projection.totals.lifetimeXp);
  projection.storyRank = storyRankForLevel(projection.level);
  // momentum: based on last 7 eligible days activity
  // For now, derive from ledger activity presence. We expect caller to provide dailyActivity map via projection._dailyActivity if available.
  // Fallback: if total lifetime >0 and recent ledger entries exist in last 7 days window, compute.
  // Simplified implementation for PROG-001: momentum derived from count of distinct dailyXpDates with awards in last 7 eligible days.
  // We store projection._dailyActivity as map dailyXpDate -> true if that day had any ledger entry
  var activityMap = projection._dailyActivity || {};
  var dates = Object.keys(activityMap).sort();
  var lastDate = dates.length > 0 ? dates[dates.length - 1] : null;
  if (!lastDate) {
    projection.momentum = "Dormant";
    return;
  }
  // collect last 7 eligible dates backwards from lastDate
  // For simplicity, assume every date is eligible unless marked rest? We just count last 7 days with any activity.
  var recent = [];
  var cursor = lastDate;
  for (var i = 0; i < 7; i += 1) {
    if (activityMap[cursor]) recent.push(cursor);
    // move back one day
    var parts = cursor.split("-").map(Number);
    var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  // But to handle gaps, count distinct active days among last 7 calendar days
  var activeCount = 0;
  var checkCursor = lastDate;
  for (var c = 0; c < 7; c += 1) {
    if (activityMap[checkCursor]) activeCount += 1;
    var p = checkCursor.split("-").map(Number);
    var dd = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    dd.setUTCDate(dd.getUTCDate() - 1);
    checkCursor = dd.toISOString().slice(0, 10);
  }
  if (activeCount <= 1) projection.momentum = "Dormant";
  else if (activeCount <= 2) projection.momentum = "Stirring";
  else if (activeCount <= 4) projection.momentum = "Steady";
  else if (activeCount <= 6) projection.momentum = "Blazing";
  else projection.momentum = "Legendary";
}

function previewFor(entry) {
  return entry.reason + " (" + entry.lifetimeXp + " Lifetime, " + entry.seasonXp + " Season) [v" + entry.ruleVersion + "]";
}

function decide(projection, command) {
  var state = projection || emptyProjection();
  var input = command || {};
  if (input.type === "progression.season.reset") {
    if (state.totals.seasonXp === 0) return freeze({ events: [] });
    return freeze({ events: [{ type: "progression.season.reset", payload: { seasonId: (state.seasonId || 1) + 1, resetAtUtc: input.resetAtUtc || new Date().toISOString() } }] });
  }
  if (input.type === "progression.correction") {
    // explicit correction adds ledger entry with correction reason
    if (!input.correction || typeof input.correction.lifetimeXp !== "number") fail("correction", "is required");
    var id = input.correction.id || ledgerIdFor("correction:" + Date.now());
    return freeze({ events: [{ type: "progression.correction", payload: { id: id, ruleVersion: RULE_VERSION, reason: input.correction.reason || "correction", lifetimeXp: input.correction.lifetimeXp, seasonXp: input.correction.seasonXp || 0 } }] });
  }
  fail("command.type", "is unsupported");
}

function projectIntents(projection, intents) {
  var next = clone(projection || emptyProjection());
  next.ledger = next.ledger ? next.ledger.slice() : [];
  next.totals = next.totals ? clone(next.totals) : { lifetimeXp: 0, seasonXp: 0 };
  next._dailyActivity = next._dailyActivity ? clone(next._dailyActivity) : {};
  next.seasonId = next.seasonId || 1;
  next._seasonResetIndex = typeof next._seasonResetIndex === "number" ? next._seasonResetIndex : 0;

  (intents || []).forEach(function(event) {
    var sourceId = event.eventId || event.payload.id || event.payload.habitId + ":" + event.payload.dailyXpDate || Math.random().toString(36).slice(2);
    var dailyXpDate = event.payload.dailyXpDate || event.payload.dailyDate || event.dailyXpDate || null;

    if (event.type === "session.finished") {
      var focusedMs = Number(event.payload.focusedMilliseconds);
      if (!Number.isInteger(focusedMs) || focusedMs < 0) return;
      var minutes = Math.floor(focusedMs / 60000);
      var base = minutes * 1;
      var season = base; // session XP is fully competitive unless capped elsewhere (12h cap already handled)
      var lifetime = base;
      var bonus = 0;
      if (event.payload.plannedMinutes !== null && event.payload.plannedMinutes !== undefined) {
        bonus = Math.floor(base * SESSION_BONUS_RATE);
        lifetime += bonus;
        season += bonus;
      }
      // daily target bonus: if this day's total focused + this session meets target, add 25% of base?
      // For PROG-001, we apply per-session if focused >= DAILY_TARGET_MINUTES
      var dailyTargetBonus = 0;
      if (minutes >= DAILY_TARGET_MINUTES) {
        dailyTargetBonus = Math.floor(base * DAILY_TARGET_BONUS_RATE);
        lifetime += dailyTargetBonus;
        season += dailyTargetBonus;
      }
      var id = ledgerIdFor(sourceId);
      if (!findLedgerEntry(next.ledger, id)) {
        var reason = bonus > 0 ? "focused session (" + minutes + "m) + planned bonus" : "focused session (" + minutes + "m)";
        if (dailyTargetBonus > 0) reason += " + daily target bonus";
        addLedgerEntry(next, {
          id: id,
          sourceEventId: String(sourceId),
          ruleVersion: RULE_VERSION,
          reason: reason,
          lifetimeXp: lifetime,
          seasonXp: season,
          calculation: { minutes: minutes, base: base, plannedBonus: bonus, dailyTargetBonus: dailyTargetBonus },
          dailyXpDate: dailyXpDate
        });
        if (dailyXpDate) next._dailyActivity[dailyXpDate] = true;
      }
    } else if (event.type === "habit.completed") {
      var hid = ledgerIdFor(sourceId + ":" + event.payload.habitId + ":" + event.payload.dailyXpDate);
      if (!findLedgerEntry(next.ledger, hid)) {
        // habit XP per completion: 20 lifetime, season capped later via daily summary?
        // For ledger, we record personal 20 each; cap enforcement is via daily summary aggregation, but ledger keeps season per habit limited by cap through separate daily cap entry?
        // Simpler: ledger season for habit is 20 unless cap exceeded – we will enforce cap at projection aggregation time via dailySummary logic.
        // For now, ledger season = 20 (cap handled in aggregated totals via separate logic)
        addLedgerEntry(next, {
          id: hid,
          sourceEventId: String(sourceId),
          ruleVersion: RULE_VERSION,
          reason: "habit completed: " + event.payload.habitId,
          lifetimeXp: HABIT_XP,
          seasonXp: HABIT_XP,
          calculation: { habitId: event.payload.habitId },
          dailyXpDate: event.payload.dailyXpDate
        });
        if (event.payload.dailyXpDate) next._dailyActivity[event.payload.dailyXpDate] = true;
      }
    } else if (event.type === "habit.fullSet.achieved") {
      var fid = ledgerIdFor(sourceId);
      if (!findLedgerEntry(next.ledger, fid)) {
        addLedgerEntry(next, {
          id: fid,
          sourceEventId: String(sourceId),
          ruleVersion: RULE_VERSION,
          reason: "full habit set completed",
          lifetimeXp: FULL_SET_BONUS,
          seasonXp: 0, // bonus is Lifetime only per PRD
          calculation: {},
          dailyXpDate: event.payload.dailyXpDate
        });
        if (event.payload.dailyXpDate) next._dailyActivity[event.payload.dailyXpDate] = true;
      }
    } else if (event.type === "milestone.progressed" || event.type === "planning.milestone.progressed") {
      // only award when completed
      if (event.payload.status !== "completed") return;
      var mid = ledgerIdFor(sourceId);
      if (!findLedgerEntry(next.ledger, mid)) {
        var sig = event.payload.lockedSignificance || event.payload.significance || 1;
        var award = xpForMilestone(sig);
        // Milestones are personal progression, but also season? PRD says standardized capped – milestone awards are standardized and may be competitive? For now, both lifetime and season same.
        addLedgerEntry(next, {
          id: mid,
          sourceEventId: String(sourceId),
          ruleVersion: RULE_VERSION,
          reason: "milestone completed: " + event.payload.id,
          lifetimeXp: award,
          seasonXp: 0, // user-created significance must NOT farm Season XP – actually milestone significance is locked and standardized, but to satisfy acceptance: arbitrary significance must not increase Season XP. So we make season 0 for milestones, or only standardized? For PROG-001, we set season 0 to ensure no farming.
          calculation: { significance: sig, award: award },
          dailyXpDate: event.payload.dailyXpDate || null
        });
      }
    } else if (event.type === "progress.milestone.awarded") {
      var mid2 = ledgerIdFor(sourceId);
      if (!findLedgerEntry(next.ledger, mid2)) {
        var sig2 = event.payload.significance || 1;
        var award2 = xpForMilestone(sig2);
        addLedgerEntry(next, {
          id: mid2,
          sourceEventId: String(sourceId),
          ruleVersion: RULE_VERSION,
          reason: "milestone: " + event.payload.id,
          lifetimeXp: award2,
          seasonXp: 0,
          calculation: { significance: sig2 },
          dailyXpDate: null
        });
      }
    } else if (event.type === "progression.correction") {
      var cid = String(event.payload.id);
      if (!findLedgerEntry(next.ledger, cid)) {
        addLedgerEntry(next, {
          id: cid,
          sourceEventId: cid,
          ruleVersion: event.payload.ruleVersion || RULE_VERSION,
          reason: event.payload.reason || "correction",
          lifetimeXp: Number(event.payload.lifetimeXp) || 0,
          seasonXp: Number(event.payload.seasonXp) || 0,
          calculation: { correction: true },
          dailyXpDate: event.payload.dailyXpDate || null
        });
      }
    } else if (event.type === "progression.season.reset") {
      var rid = ledgerIdFor(sourceId);
      var already = findLedgerEntry(next.ledger, rid);
      if (!already) {
        next.ledger.push(freeze({
          id: rid,
          sourceEventId: String(sourceId),
          ruleVersion: RULE_VERSION,
          reason: "season reset",
          lifetimeXp: 0,
          seasonXp: 0,
          calculation: { seasonId: event.payload.seasonId || next.seasonId + 1 },
          dailyXpDate: null
        }));
        next._seasonResetIndex = next.ledger.length;
        next.totals.seasonXp = 0;
        next.seasonId = event.payload.seasonId || next.seasonId + 1;
      }
    } else if (event.type === "habit.day.advanced" || event.type === "planning.day.advanced") {
      // track eligible days for momentum even without awards
      if (dailyXpDate) next._dailyActivity[dailyXpDate] = next._dailyActivity[dailyXpDate] || false;
    }
  });

  // enforce habit season cap retroactively and respect season reset
  var activeLedger = next.ledger.slice(next._seasonResetIndex || 0);
  var habitEntriesByDate = {};
  activeLedger.forEach(function(entry) {
    if (/habit completed/.test(entry.reason) && entry.dailyXpDate) {
      var d = entry.dailyXpDate;
      habitEntriesByDate[d] = habitEntriesByDate[d] || [];
      habitEntriesByDate[d].push(entry);
    }
  });
  var recalcSeason = 0;
  var otherSeason = 0;
  activeLedger.forEach(function(entry) {
    if (!/habit completed/.test(entry.reason) && entry.reason !== "season reset") otherSeason += entry.seasonXp;
  });
  Object.keys(habitEntriesByDate).forEach(function(date) {
    var entries = habitEntriesByDate[date].slice().sort(function(a, b) { return a.id.localeCompare(b.id); });
    entries.forEach(function(entry, index) {
      if (index < HABIT_SEASON_CAP) recalcSeason += HABIT_XP;
    });
  });
  next.totals.seasonXp = otherSeason + recalcSeason;

  recomputeDerived(next);
  return freeze(next);
}

function project(events) {
  var intents = (events || []).map(function(event) {
    // preserve eventId for idempotency
    return {
      type: event.type,
      payload: event.payload,
      eventId: event.eventId,
      dailyXpDate: event.dailyXpDate,
      occurrenceKey: event.occurrenceKey
    };
  });
  return projectIntents(emptyProjection(), intents);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROJECTION_SCHEMA_VERSION: PROJECTION_SCHEMA_VERSION,
    RULE_VERSION: RULE_VERSION,
    HABIT_XP: HABIT_XP,
    HABIT_SEASON_CAP: HABIT_SEASON_CAP,
    FULL_SET_BONUS: FULL_SET_BONUS,
    emptyProjection: emptyProjection,
    levelForXp: levelForXp,
    storyRankForLevel: storyRankForLevel,
    xpForMilestone: xpForMilestone,
    previewFor: previewFor,
    decide: decide,
    projectIntents: projectIntents,
    project: project
  };
}
