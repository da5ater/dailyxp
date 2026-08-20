// Pure planning commands and projections. QML persists the returned event
// intents through EventModel; this module owns no clock, filesystem, or UI.

var PROJECTION_SCHEMA_VERSION = 1;
var GOAL_STATUSES = ["active", "paused", "achieved", "abandoned", "archived"];
var MEASUREMENT_TYPES = ["binary", "numeric", "time", "task", "consistency"];
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var OCCURRENCE_STATUSES = [
  "open", "overdue", "completed", "rescheduled", "skipped", "dismissed", "archived", "merged"
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
    goals: [], milestones: [], tasks: [], routines: [], occurrences: [], suggestions: []
  });
}

function required(value, field) {
  if (String(value || "").trim() === "") fail(field, "is required");
}

function findById(items, id) {
  for (var i = 0; i < items.length; i += 1) if (items[i].id === id) return items[i];
  return null;
}

function applyChanges(target, changes) {
  Object.keys(changes || {}).forEach(function(key) { target[key] = clone(changes[key]); });
}

function isUntouchedOccurrence(occurrence) {
  return occurrence.status === "open" || occurrence.status === "overdue";
}

function ensureUnique(projection, id) {
  var collections = [projection.goals, projection.milestones, projection.tasks, projection.routines];
  for (var i = 0; i < collections.length; i += 1)
    if (findById(collections[i], id)) fail("id", "already exists");
}

function dateValue(value, field) {
  if (!DATE_PATTERN.test(String(value || ""))) fail(field, "must be YYYY-MM-DD");
  var parts = value.split("-").map(Number);
  var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (date.toISOString().slice(0, 10) !== value) fail(field, "is not a calendar date");
  return date;
}

function routineOccurrenceKey(routineId, dailyXpDate) {
  return "routine:" + encodeURIComponent(routineId) + ":day:" + dailyXpDate;
}

function scheduledOn(routine, dailyXpDate) {
  var date = dateValue(dailyXpDate, "dailyXpDate");
  if (dailyXpDate < routine.startDate || (routine.endDate && dailyXpDate > routine.endDate)) return false;
  if ((routine.restDates || []).indexOf(dailyXpDate) !== -1) return false;
  if (routine.schedule.type === "weekdays") {
    var weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    return routine.schedule.weekdays.indexOf(weekday) !== -1;
  }
  if (routine.schedule.type === "interval") {
    var anchor = dateValue(routine.schedule.anchorDate, "routine.schedule.anchorDate");
    var days = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
    return days >= 0 && days % routine.schedule.everyDays === 0;
  }
  return false;
}

function intent(type, payload, occurrenceKey) {
  return freeze({ type: "planning." + type, payload: clone(payload), occurrenceKey: occurrenceKey || null });
}

function decide(projection, command) {
  var plan = projection || emptyProjection();
  var input = command || {};
  var entity;
  if (input.type === "goal.create") {
    entity = clone(input.goal || {});
    required(entity.id, "goal.id"); required(entity.title, "goal.title"); ensureUnique(plan, entity.id);
    entity.status = entity.status || "active";
    if (GOAL_STATUSES.indexOf(entity.status) === -1) fail("goal.status", "is invalid");
    return freeze({ events: [intent("goal.created", entity)] });
  }
  if (input.type === "milestone.create") {
    entity = clone(input.milestone || {});
    required(entity.id, "milestone.id"); required(entity.title, "milestone.title"); ensureUnique(plan, entity.id);
    if (!findById(plan.goals, entity.goalId)) fail("milestone.goalId", "must reference a Goal");
    if (!entity.measurement || MEASUREMENT_TYPES.indexOf(entity.measurement.type) === -1)
      fail("milestone.measurement", "is invalid");
    entity.status = "open";
    return freeze({ events: [intent("milestone.created", entity)] });
  }
  if (input.type === "task.create") {
    entity = clone(input.task || {});
    required(entity.id, "task.id"); required(entity.title, "task.title"); ensureUnique(plan, entity.id);
    if (entity.goalId && !findById(plan.goals, entity.goalId)) fail("task.goalId", "must reference a Goal");
    if (entity.milestoneId && !findById(plan.milestones, entity.milestoneId))
      fail("task.milestoneId", "must reference a Milestone");
    entity.status = "open";
    return freeze({ events: [intent("task.created", entity)] });
  }
  if (input.type === "routine.create") {
    entity = clone(input.routine || {});
    required(entity.id, "routine.id"); required(entity.title, "routine.title"); ensureUnique(plan, entity.id);
    dateValue(entity.startDate, "routine.startDate");
    if (entity.endDate) dateValue(entity.endDate, "routine.endDate");
    if (!entity.schedule || ["weekdays", "interval"].indexOf(entity.schedule.type) === -1)
      fail("routine.schedule", "is invalid");
    if (entity.schedule.type === "weekdays" && (!Array.isArray(entity.schedule.weekdays) ||
        entity.schedule.weekdays.some(function(day) { return !Number.isInteger(day) || day < 1 || day > 7; })))
      fail("routine.schedule.weekdays", "must contain ISO weekdays 1 through 7");
    if (entity.schedule.type === "interval" && (!Number.isInteger(entity.schedule.everyDays) || entity.schedule.everyDays < 1))
      fail("routine.schedule.everyDays", "must be a positive integer");
    entity.status = "active";
    entity.revision = 1;
    return freeze({ events: [intent("routine.created", entity)] });
  }
  if (input.type === "day.advance") {
    dateValue(input.dailyXpDate, "dailyXpDate");
    var events = [];
    plan.occurrences.forEach(function(occurrence) {
      if (occurrence.status === "open" && occurrence.dailyXpDate < input.dailyXpDate) {
        var routine = findById(plan.routines, occurrence.routineId);
        if (routine && routine.carryover) events.push(intent("occurrence.overdue", { id: occurrence.id }));
      }
    });
    plan.routines.forEach(function(routine) {
      var key = routineOccurrenceKey(routine.id, input.dailyXpDate);
      var exists = plan.occurrences.some(function(item) { return item.occurrenceKey === key; });
      if (routine.status === "active" && !exists && scheduledOn(routine, input.dailyXpDate)) {
        events.push(intent("occurrence.created", {
          id: key, occurrenceKey: key, routineId: routine.id, routineRevision: routine.revision,
          dailyXpDate: input.dailyXpDate, title: routine.title,
          expectedMinutes: routine.expectedMinutes, primarySkill: routine.primarySkill,
          goalId: routine.goalId || null, milestoneId: routine.milestoneId || null, status: "open"
        }, key));
      }
    });
    return freeze({ events: events });
  }
  if (input.type === "occurrence.transition") {
    var occurrence = findById(plan.occurrences, input.id);
    if (!occurrence) fail("occurrence.id", "was not found");
    if (OCCURRENCE_STATUSES.indexOf(input.status) === -1 || ["open", "overdue"].indexOf(input.status) !== -1)
      fail("occurrence.status", "is not a terminal action");
    if (["open", "overdue"].indexOf(occurrence.status) === -1) fail("occurrence.status", "is already resolved");
    return freeze({ events: [intent("occurrence.transitioned", { id: occurrence.id, status: input.status })] });
  }
  if (input.type === "routine.edit") {
    var existingRoutine = findById(plan.routines, input.id);
    if (!existingRoutine) fail("routine.id", "was not found");
    if (["today", "today_and_future", "all_untouched"].indexOf(input.scope) === -1)
      fail("routine.scope", "is invalid");
    dateValue(input.dailyXpDate, "dailyXpDate");
    var changes = clone(input.changes || {});
    var editEvents = [];
    if (input.scope !== "today") {
      var updatedRoutine = clone(existingRoutine);
      applyChanges(updatedRoutine, changes);
      updatedRoutine.revision += 1;
      editEvents.push(intent("routine.updated", updatedRoutine));
    }
    plan.occurrences.forEach(function(item) {
      var inScope = input.scope === "today" ? item.dailyXpDate === input.dailyXpDate
        : input.scope === "today_and_future" ? item.dailyXpDate >= input.dailyXpDate : true;
      if (item.routineId === input.id && isUntouchedOccurrence(item) && inScope)
        editEvents.push(intent("occurrence.updated", { id: item.id, changes: changes }));
    });
    return freeze({ events: editEvents });
  }
  if (input.type === "proposal.preview" || input.type === "proposal.edit") {
    var preview = clone(input.proposal || {});
    required(preview.id, "proposal.id");
    if (["template", "adaptive"].indexOf(preview.kind) === -1) fail("proposal.kind", "is invalid");
    if (!Array.isArray(preview.commands)) fail("proposal.commands", "must be an array");
    if (input.type === "proposal.edit") applyChanges(preview, input.changes);
    return freeze({ events: [], preview: preview });
  }
  if (input.type === "proposal.dismiss") {
    required(input.proposalId, "proposal.id");
    return freeze({ events: [intent("proposal.dismissed", {
      id: input.proposalId, kind: input.kind, status: "dismissed", dismissedUntil: input.dismissedUntil || null
    })] });
  }
  if (input.type === "proposal.accept") {
    var accepted = clone(input.proposal || {});
    required(accepted.id, "proposal.id");
    if (!Array.isArray(accepted.commands)) fail("proposal.commands", "must be an array");
    var acceptedEvents = [];
    var working = plan;
    accepted.commands.forEach(function(proposalCommand) {
      if (/^proposal\./.test(String(proposalCommand.type || ""))) fail("proposal.commands", "cannot nest proposals");
      var outcome = decide(working, proposalCommand);
      acceptedEvents = acceptedEvents.concat(outcome.events);
      working = projectIntents(working, outcome.events);
    });
    acceptedEvents.push(intent("proposal.accepted", {
      id: accepted.id, kind: accepted.kind, status: "accepted", explanation: accepted.explanation || ""
    }));
    return freeze({ events: acceptedEvents });
  }
  if (input.type === "task.transition") {
    var task = findById(plan.tasks, input.id);
    if (!task) fail("task.id", "was not found");
    if (["completed", "archived"].indexOf(input.status) === -1) fail("task.status", "is invalid");
    return freeze({ events: [intent("task.transitioned", { id: task.id, status: input.status })] });
  }
  if (input.type === "goal.transition") {
    var goal = findById(plan.goals, input.id);
    if (!goal) fail("goal.id", "was not found");
    if (GOAL_STATUSES.indexOf(input.status) === -1) fail("goal.status", "is invalid");
    return freeze({ events: [intent("goal.transitioned", { id: goal.id, status: input.status })] });
  }
  if (input.type === "entity.remove") {
    var collectionName = input.entityType + "s";
    if (["goals", "milestones", "tasks", "routines"].indexOf(collectionName) === -1)
      fail("entityType", "is invalid");
    var removable = findById(plan[collectionName], input.id);
    if (!removable) fail(input.entityType + ".id", "was not found");
    var hasHistory = removable.status !== "open" && removable.status !== "active";
    if (input.entityType === "routine")
      hasHistory = hasHistory || plan.occurrences.some(function(item) { return item.routineId === input.id; });
    if (input.entityType === "goal")
      hasHistory = hasHistory || plan.milestones.some(function(item) { return item.goalId === input.id; }) ||
        plan.tasks.some(function(item) { return item.goalId === input.id; }) ||
        plan.routines.some(function(item) { return item.goalId === input.id; });
    return freeze({ events: [intent(hasHistory ? "entity.archived" : "entity.deleted", {
      entityType: input.entityType, id: input.id
    })] });
  }
  if (input.type === "milestone.progress") {
    var milestone = findById(plan.milestones, input.id);
    if (!milestone) fail("milestone.id", "was not found");
    var progress = input.value;
    if (milestone.measurement.type === "binary") progress = input.value === true ? true : false;
    else if (typeof progress !== "number" || !isFinite(progress) || progress < 0)
      fail("milestone.progress", "must be a nonnegative number");
    var completed = milestone.measurement.type === "binary" ? progress === true
      : typeof milestone.measurement.target === "number" && progress >= milestone.measurement.target;
    return freeze({ events: [intent("milestone.progressed", {
      id: milestone.id, progress: progress,
      lockedSignificance: milestone.lockedSignificance || milestone.significance,
      status: completed ? "completed" : "open"
    })] });
  }
  if (input.type === "milestone.edit") {
    var editableMilestone = findById(plan.milestones, input.id);
    if (!editableMilestone) fail("milestone.id", "was not found");
    if (editableMilestone.lockedSignificance && Object.prototype.hasOwnProperty.call(input.changes || {}, "significance") &&
        input.changes.significance !== editableMilestone.significance)
      fail("milestone.significance", "is locked after progress begins");
    return freeze({ events: [intent("milestone.updated", { id: input.id, changes: clone(input.changes || {}) })] });
  }
  fail("command.type", "is unsupported");
}

function replace(items, entity) {
  var result = items.map(clone);
  for (var i = 0; i < result.length; i += 1) {
    if (result[i].id === entity.id) { result[i] = clone(entity); return result; }
  }
  result.push(clone(entity));
  return result;
}

function projectIntents(projection, intents) {
  var next = clone(projection || emptyProjection());
  (intents || []).forEach(function(event) {
    if (event.type === "planning.goal.created") next.goals = replace(next.goals, event.payload);
    else if (event.type === "planning.milestone.created") next.milestones = replace(next.milestones, event.payload);
    else if (event.type === "planning.task.created") next.tasks = replace(next.tasks, event.payload);
    else if (event.type === "planning.routine.created") next.routines = replace(next.routines, event.payload);
    else if (event.type === "planning.occurrence.created") {
      var occurrenceExists = next.occurrences.some(function(item) {
        return item.occurrenceKey === event.payload.occurrenceKey;
      });
      if (!occurrenceExists) next.occurrences.push(clone(event.payload));
    } else if (event.type === "planning.occurrence.overdue") {
      var overdue = findById(next.occurrences, event.payload.id);
      if (overdue && overdue.status === "open") overdue.status = "overdue";
    } else if (event.type === "planning.occurrence.transitioned") {
      var transitioned = findById(next.occurrences, event.payload.id);
      if (transitioned && isUntouchedOccurrence(transitioned))
        transitioned.status = event.payload.status;
    } else if (event.type === "planning.routine.updated") {
      next.routines = replace(next.routines, event.payload);
    } else if (event.type === "planning.occurrence.updated") {
      var updatedOccurrence = findById(next.occurrences, event.payload.id);
      if (updatedOccurrence && isUntouchedOccurrence(updatedOccurrence))
        applyChanges(updatedOccurrence, event.payload.changes);
    } else if (event.type === "planning.proposal.dismissed" || event.type === "planning.proposal.accepted") {
      next.suggestions = replace(next.suggestions, event.payload);
    } else if (event.type === "planning.task.transitioned") {
      var transitionedTask = findById(next.tasks, event.payload.id);
      if (transitionedTask) transitionedTask.status = event.payload.status;
    } else if (event.type === "planning.goal.transitioned") {
      var transitionedGoal = findById(next.goals, event.payload.id);
      if (transitionedGoal) transitionedGoal.status = event.payload.status;
    } else if (event.type === "planning.entity.deleted") {
      var deleteCollection = event.payload.entityType + "s";
      next[deleteCollection] = next[deleteCollection].filter(function(item) { return item.id !== event.payload.id; });
    } else if (event.type === "planning.entity.archived") {
      var archiveCollection = event.payload.entityType + "s";
      var archived = findById(next[archiveCollection], event.payload.id);
      if (archived) archived.status = "archived";
    } else if (event.type === "planning.milestone.progressed") {
      var progressedMilestone = findById(next.milestones, event.payload.id);
      if (progressedMilestone) {
        progressedMilestone.progress = event.payload.progress;
        progressedMilestone.lockedSignificance = event.payload.lockedSignificance;
        progressedMilestone.status = event.payload.status;
      }
    } else if (event.type === "planning.milestone.updated") {
      var updatedMilestone = findById(next.milestones, event.payload.id);
      if (updatedMilestone) applyChanges(updatedMilestone, event.payload.changes);
    }
  });
  return freeze(next);
}

function project(events) {
  var projection = emptyProjection();
  var intents = (events || []).filter(function(event) { return /^planning\./.test(event.type); }).map(function(event) {
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
    project: project
  };
}
