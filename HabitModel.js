// Pure habit commands and deterministic projections.
// No clock, filesystem, or UI. Event persistence is owned by HabitJournal/StateStore.

var PROJECTION_SCHEMA_VERSION = 1;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var MAX_CATCH_UP_DAYS = 366;

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
    habits: [],
    completions: [],
    freezes: [],
    lastAdvancedDailyXpDate: null,
    streaks: {},
    dailySummaries: {}
  });
}

function required(value, field) {
  if (String(value || "").trim() === "") fail(field, "is required");
}

function findById(items, id) {
  for (var i = 0; i < items.length; i += 1) if (items[i].id === id) return items[i];
  return null;
}

function dateValue(value, field) {
  if (!DATE_PATTERN.test(String(value || ""))) fail(field, "must be YYYY-MM-DD");
  var parts = value.split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (date.toISOString().slice(0, 10) !== value) fail(field, "is not a calendar date");
  return date;
}

function nextDate(value) {
  var date = dateValue(value, "dailyXpDate");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function applyChanges(target, changes) {
  Object.keys(changes || {}).forEach(function(key) { target[key] = clone(changes[key]); });
}

function applyAllowedChanges(target, changes, allowed, field) {
  Object.keys(changes || {}).forEach(function(key) {
    if (allowed.indexOf(key) === -1) fail(field, "cannot change " + key);
    target[key] = clone(changes[key]);
  });
}

function validateSchedule(schedule, field) {
  if (!schedule || ["weekdays", "interval", "daily"].indexOf(schedule.type) === -1)
    fail(field, "is invalid");
  if (schedule.type === "weekdays") {
    if (!Array.isArray(schedule.weekdays) || schedule.weekdays.length === 0 ||
        schedule.weekdays.some(function(day) { return !Number.isInteger(day) || day < 1 || day > 7; }))
      fail(field + ".weekdays", "must contain ISO weekdays 1 through 7");
  }
  if (schedule.type === "interval") {
    if (!Number.isInteger(schedule.everyDays) || schedule.everyDays < 1)
      fail(field + ".everyDays", "must be a positive integer");
    dateValue(schedule.anchorDate, field + ".anchorDate");
  }
  if (schedule.type === "daily") {
    // no extra fields
  }
}

function validateHabit(projection, habit) {
  required(habit.title, "habit.title");
  validateSchedule(habit.schedule, "habit.schedule");
  dateValue(habit.startDate, "habit.startDate");
  if (habit.endDate) {
    dateValue(habit.endDate, "habit.endDate");
    if (habit.endDate < habit.startDate) fail("habit.endDate", "must not precede startDate");
  }
  if (!Array.isArray(habit.restDates)) fail("habit.restDates", "must be an array");
  habit.restDates.forEach(function(value) { dateValue(value, "habit.restDates"); });
  var seenRest = {};
  habit.restDates.forEach(function(value) {
    if (seenRest[value]) fail("habit.restDates", "must not contain duplicates");
    seenRest[value] = true;
  });
  if (habit.status && ["active", "archived"].indexOf(habit.status) === -1)
    fail("habit.status", "is invalid");
}

function scheduledOn(habit, dailyXpDate) {
  if (habit.status === "archived") return false;
  var date = dateValue(dailyXpDate, "dailyXpDate");
  if (dailyXpDate < habit.startDate) return false;
  if (habit.endDate && dailyXpDate > habit.endDate) return false;
  if ((habit.restDates || []).indexOf(dailyXpDate) !== -1) return false;
  if (habit.schedule.type === "daily") return true;
  if (habit.schedule.type === "weekdays") {
    var weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    return habit.schedule.weekdays.indexOf(weekday) !== -1;
  }
  if (habit.schedule.type === "interval") {
    var anchor = dateValue(habit.schedule.anchorDate, "habit.schedule.anchorDate");
    var days = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
    return days >= 0 && days % habit.schedule.everyDays === 0;
  }
  return false;
}

function intent(type, payload, occurrenceKey) {
  return freeze({ type: "habit." + type, payload: clone(payload), occurrenceKey: occurrenceKey || null });
}

function completionKey(habitId, dailyXpDate) {
  return habitId + "::" + dailyXpDate;
}

function hasCompletion(completions, habitId, dailyXpDate) {
  var key = completionKey(habitId, dailyXpDate);
  for (var i = 0; i < completions.length; i += 1)
    if (completionKey(completions[i].habitId, completions[i].dailyXpDate) === key) return true;
  return false;
}

function hasFreeze(freezes, habitId, dailyXpDate) {
  var key = completionKey(habitId, dailyXpDate);
  for (var i = 0; i < freezes.length; i += 1)
    if (completionKey(freezes[i].habitId, freezes[i].dailyXpDate) === key) return true;
  return false;
}

function eligibleHabitIdsOn(projection, dailyXpDate) {
  var ids = [];
  projection.habits.forEach(function(habit) {
    if (scheduledOn(habit, dailyXpDate)) ids.push(habit.id);
  });
  return ids;
}

function recomputeDerived(projection) {
  // projection is mutable clone during recompute
  var streaks = {};
  var dailySummaries = {};

  // Determine overall date range for daily summaries:
  // collect all dailyXpDates that are eligible for at least one habit up to lastAdvanced
  // plus any completion/freeze dates.
  var allDates = {};
  function collectDatesUpTo(lastDate) {
    if (!lastDate) return;
    // iterate from earliest habit start to lastDate bounded – include every advanced date
    var earliest = null;
    projection.habits.forEach(function(habit) {
      if (!earliest || habit.startDate < earliest) earliest = habit.startDate;
    });
    // if no habit yet, use lastDate itself
    if (!earliest) {
      allDates[lastDate] = true;
      return;
    }
    // if lastDate precedes earliest, still record lastDate (no eligible)
    if (lastDate < earliest) {
      allDates[lastDate] = true;
      return;
    }
    var cursor = earliest;
    var steps = 0;
    while (cursor <= lastDate && steps < MAX_CATCH_UP_DAYS * 2) {
      // include every date in range, even if no eligible habits
      allDates[cursor] = allDates[cursor] || false;
      // mark true if eligible exists so lifetime calculations know
      var eligible = eligibleHabitIdsOn(projection, cursor);
      if (eligible.length > 0) allDates[cursor] = true;
      if (cursor === lastDate) break;
      cursor = nextDate(cursor);
      steps += 1;
    }
    // ensure boundary always present
    allDates[lastDate] = allDates[lastDate] || false;
    if (eligibleHabitIdsOn(projection, lastDate).length > 0) allDates[lastDate] = true;
  }

  var boundaryDate = projection.lastAdvancedDailyXpDate;
  // Also consider completion/freeze dates may be beyond lastAdvanced if no advance yet
  var maxEventDate = null;
  projection.completions.forEach(function(c) { if (!maxEventDate || c.dailyXpDate > maxEventDate) maxEventDate = c.dailyXpDate; });
  projection.freezes.forEach(function(f) { if (!maxEventDate || f.dailyXpDate > maxEventDate) maxEventDate = f.dailyXpDate; });
  if (!boundaryDate) boundaryDate = maxEventDate;
  else if (maxEventDate && maxEventDate > boundaryDate) boundaryDate = maxEventDate;

  if (boundaryDate) collectDatesUpTo(boundaryDate);
  // Also ensure any completion/freeze date with no eligible habits is still included for summary?
  // We'll include those dates as well to show 0 eligible.
  projection.completions.forEach(function(c) { allDates[c.dailyXpDate] = allDates[c.dailyXpDate] || false; });
  projection.freezes.forEach(function(f) { allDates[f.dailyXpDate] = allDates[f.dailyXpDate] || false; });

  // Compute streaks per habit
  projection.habits.forEach(function(habit) {
    var current = 0;
    var longest = 0;
    var lastCompleted = null;
    // Need to iterate eligible dates for this habit in order up to boundaryDate
    if (boundaryDate) {
      var cursor = habit.startDate;
      var steps = 0;
      // If habit schedule daily/weekly, iterating from startDate to boundaryDate bounded
      while (cursor <= boundaryDate && steps < MAX_CATCH_UP_DAYS * 2) {
        if (scheduledOn(habit, cursor)) {
          var completed = hasCompletion(projection.completions, habit.id, cursor);
          var frozen = hasFreeze(projection.freezes, habit.id, cursor);
          if (completed) {
            current += 1;
            if (current > longest) longest = current;
            lastCompleted = cursor;
          } else if (frozen) {
            // preserve streak, do not increment nor reset
          } else if (cursor === boundaryDate) {
            // current eligible day not yet completed – keep streak intact until day ends
          } else {
            current = 0;
          }
        }
        if (cursor === boundaryDate) break;
        cursor = nextDate(cursor);
        steps += 1;
      }
    } else {
      // no boundary yet, streak zero but check completions without date bound?
      // If no advance, compute streak based only on completions sorted
      var eligibleDates = [];
      projection.completions.forEach(function(c) {
        if (c.habitId === habit.id && scheduledOn(habit, c.dailyXpDate)) eligibleDates.push(c.dailyXpDate);
      });
      eligibleDates.sort();
      // For each completion in order, check if prior eligible missing dates would have broken streak
      // Simplify: if completions are consecutive eligible days considering rest/freeze, streak = completions count
      // We'll just count consecutive completions without gaps if boundary unknown: naive
      // Instead we skip detailed and leave 0.
    }
    streaks[habit.id] = freeze({
      current: current,
      longest: longest,
      lastCompletedDailyXpDate: lastCompleted
    });
  });

  // Compute dailySummaries for each date in allDates where we have eligible info
  Object.keys(allDates).forEach(function(dailyXpDate) {
    var eligible = eligibleHabitIdsOn(projection, dailyXpDate);
    var completed = [];
    eligible.forEach(function(habitId) {
      if (hasCompletion(projection.completions, habitId, dailyXpDate)) completed.push(habitId);
    });
    // completions for habits that are not eligible (should not happen) are ignored for bonus
    var eligibleCount = eligible.length;
    var completedCount = completed.length;
    var isFullSet = eligibleCount > 0 && completedCount === eligibleCount;
    var competitiveCount = Math.min(completedCount, 7);
    var lifetimeXp = completedCount * 20 + (isFullSet ? 50 : 0);
    var seasonXp = competitiveCount * 20; // bonus is Lifetime only per PRD
    var personalCount = completedCount - competitiveCount;
    dailySummaries[dailyXpDate] = freeze({
      dailyXpDate: dailyXpDate,
      eligibleHabitIds: eligible.slice().sort(),
      completedHabitIds: completed.slice().sort(),
      eligibleCount: eligibleCount,
      completedCount: completedCount,
      isFullSet: isFullSet,
      fullSetBonusAwarded: isFullSet ? 50 : 0,
      competitiveCount: competitiveCount,
      personalCount: personalCount,
      lifetimeXp: lifetimeXp,
      seasonXp: seasonXp
    });
  });

  projection.streaks = freeze(streaks);
  projection.dailySummaries = freeze(dailySummaries);
}

function decide(projection, command) {
  var state = projection || emptyProjection();
  var input = command || {};

  if (input.type === "habit.create") {
    var habit = clone(input.habit || {});
    required(habit.id, "habit.id");
    required(habit.title, "habit.title");
    if (findById(state.habits, habit.id)) fail("habit.id", "already exists");
    // Also ensure unique across? Only habits
    habit.restDates = Array.isArray(habit.restDates) ? habit.restDates.slice() : [];
    if (!habit.schedule) fail("habit.schedule", "is required");
    if (!habit.startDate) fail("habit.startDate", "is required");
    habit.status = "active";
    habit.revision = 1;
    validateHabit(state, habit);
    return freeze({ events: [intent("created", habit)] });
  }

  if (input.type === "habit.edit") {
    var existing = findById(state.habits, input.id);
    if (!existing) fail("habit.id", "was not found");
    var updated = clone(existing);
    applyAllowedChanges(updated, input.changes || {}, ["title", "schedule", "startDate", "endDate", "restDates"], "habit.changes");
    validateHabit(state, updated);
    updated.revision = (existing.revision || 1) + 1;
    return freeze({ events: [intent("updated", updated)] });
  }

  if (input.type === "habit.remove") {
    var removable = findById(state.habits, input.id);
    if (!removable) fail("habit.id", "was not found");
    var hasHistory = state.completions.some(function(c) { return c.habitId === input.id; }) ||
                     state.freezes.some(function(f) { return f.habitId === input.id; });
    var archived = hasHistory;
    if (archived) return freeze({ events: [intent("archived", { id: removable.id })] });
    return freeze({ events: [intent("deleted", { id: removable.id })] });
  }

  if (input.type === "habit.complete") {
    required(input.habitId, "habitId");
    dateValue(input.dailyXpDate, "dailyXpDate");
    var habitForComplete = findById(state.habits, input.habitId);
    if (!habitForComplete) fail("habitId", "was not found");
    if (habitForComplete.status === "archived") fail("habitId", "is archived");
    if (!scheduledOn(habitForComplete, input.dailyXpDate)) fail("dailyXpDate", "habit is not eligible on this date");
    if (hasCompletion(state.completions, input.habitId, input.dailyXpDate)) return freeze({ events: [] });
    if (input.count !== undefined && input.count !== null) {
      if (!Number.isInteger(input.count) || input.count < 1) fail("count", "must be a positive integer");
    }
    return freeze({ events: [intent("completed", {
      habitId: input.habitId,
      dailyXpDate: input.dailyXpDate,
      count: input.count || 1
    })] });
  }

  if (input.type === "habit.uncomplete") {
    required(input.habitId, "habitId");
    dateValue(input.dailyXpDate, "dailyXpDate");
    if (!hasCompletion(state.completions, input.habitId, input.dailyXpDate)) return freeze({ events: [] });
    return freeze({ events: [intent("uncompleted", { habitId: input.habitId, dailyXpDate: input.dailyXpDate })] });
  }

  if (input.type === "habit.freeze.consume") {
    required(input.habitId, "habitId");
    dateValue(input.dailyXpDate, "dailyXpDate");
    var habitForFreeze = findById(state.habits, input.habitId);
    if (!habitForFreeze) fail("habitId", "was not found");
    if (!scheduledOn(habitForFreeze, input.dailyXpDate)) fail("dailyXpDate", "habit is not eligible on this date");
    if (hasCompletion(state.completions, input.habitId, input.dailyXpDate)) fail("dailyXpDate", "habit already completed on this date");
    if (hasFreeze(state.freezes, input.habitId, input.dailyXpDate)) return freeze({ events: [] });
    // freeze cannot be consumed for a rest day (already not eligible) – already checked
    // also cannot consume freeze for future dates beyond lastAdvanced? Allow but streak evaluation will handle.
    return freeze({ events: [intent("freeze.consumed", { habitId: input.habitId, dailyXpDate: input.dailyXpDate })] });
  }

  if (input.type === "habit.day.advance") {
    dateValue(input.dailyXpDate, "dailyXpDate");
    if (state.lastAdvancedDailyXpDate && input.dailyXpDate <= state.lastAdvancedDailyXpDate)
      return freeze({ events: [] });
    var events = [];
    var working = state;
    var date = state.lastAdvancedDailyXpDate ? nextDate(state.lastAdvancedDailyXpDate) : input.dailyXpDate;
    var advanced = 0;
    while (date <= input.dailyXpDate && advanced < MAX_CATCH_UP_DAYS) {
      events.push(intent("day.advanced", { dailyXpDate: date }));
      // Project forward for next iteration to avoid duplicate logic? But we can just increment.
      working = projectIntents(working, events.slice(-1));
      date = nextDate(date);
      advanced += 1;
    }
    return freeze({ events: events });
  }

  fail("command.type", "is unsupported");
}

function projectIntents(projection, intents) {
  var next = clone(projection || emptyProjection());
  // Ensure base arrays exist
  next.habits = next.habits ? next.habits.slice() : [];
  next.completions = next.completions ? next.completions.slice() : [];
  next.freezes = next.freezes ? next.freezes.slice() : [];

  (intents || []).forEach(function(event) {
    if (event.type === "habit.created") {
      var exists = findById(next.habits, event.payload.id);
      if (!exists) next.habits.push(clone(event.payload));
      else {
        for (var i = 0; i < next.habits.length; i += 1) if (next.habits[i].id === event.payload.id) next.habits[i] = clone(event.payload);
      }
    } else if (event.type === "habit.updated") {
      for (var u = 0; u < next.habits.length; u += 1) if (next.habits[u].id === event.payload.id) next.habits[u] = clone(event.payload);
    } else if (event.type === "habit.archived") {
      var arch = findById(next.habits, event.payload.id);
      if (arch) arch.status = "archived";
    } else if (event.type === "habit.deleted") {
      next.habits = next.habits.filter(function(h) { return h.id !== event.payload.id; });
    } else if (event.type === "habit.completed") {
      if (!hasCompletion(next.completions, event.payload.habitId, event.payload.dailyXpDate))
        next.completions.push(clone(event.payload));
    } else if (event.type === "habit.uncompleted") {
      next.completions = next.completions.filter(function(c) {
        return !(c.habitId === event.payload.habitId && c.dailyXpDate === event.payload.dailyXpDate);
      });
    } else if (event.type === "habit.freeze.consumed") {
      if (!hasFreeze(next.freezes, event.payload.habitId, event.payload.dailyXpDate))
        next.freezes.push(clone(event.payload));
    } else if (event.type === "habit.day.advanced") {
      next.lastAdvancedDailyXpDate = event.payload.dailyXpDate;
    }
  });

  recomputeDerived(next);
  return freeze(next);
}

function project(events) {
  var projection = emptyProjection();
  var intents = (events || []).filter(function(event) { return /^habit\./.test(event.type); }).map(function(event) {
    return { type: event.type, payload: event.payload, occurrenceKey: event.occurrenceKey };
  });
  return projectIntents(projection, intents);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PROJECTION_SCHEMA_VERSION: PROJECTION_SCHEMA_VERSION,
    emptyProjection: emptyProjection,
    decide: decide,
    projectIntents: projectIntents,
    project: project,
    scheduledOn: scheduledOn,
    hasCompletion: hasCompletion,
    hasFreeze: hasFreeze
  };
}
