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
    goals: [], milestones: [], tasks: [], routines: [], occurrences: [], proposals: []
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

function applyAllowedChanges(target, changes, allowed, field) {
  Object.keys(changes || {}).forEach(function(key) {
    if (allowed.indexOf(key) === -1) fail(field, "cannot change " + key);
    target[key] = clone(changes[key]);
  });
}

function isUntouchedOccurrence(occurrence) {
  return occurrence.status === "open" || occurrence.status === "overdue";
}

function ensureUnique(projection, id) {
  var collections = [projection.goals, projection.milestones, projection.tasks, projection.routines];
  for (var i = 0; i < collections.length; i += 1)
    if (findById(collections[i], id)) fail("id", "already exists");
}

function initializeEntity(projection, value, field) {
  var entity = clone(value || {});
  required(entity.id, field + ".id");
  required(entity.title, field + ".title");
  ensureUnique(projection, entity.id);
  return entity;
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

function occurrenceFromRoutine(routine, dailyXpDate, id, occurrenceKey) {
  return {
    id: id, occurrenceKey: occurrenceKey, routineId: routine.id, routineRevision: routine.revision,
    dailyXpDate: dailyXpDate, title: routine.title,
    expectedMinutes: routine.expectedMinutes, primarySkill: routine.primarySkill,
    goalId: routine.goalId || null, milestoneId: routine.milestoneId || null, status: "open"
  };
}

function resolveGoalMilestoneLinks(projection, entity, field) {
  var milestone = entity.milestoneId ? findById(projection.milestones, entity.milestoneId) : null;
  if (entity.milestoneId && !milestone) fail(field + ".milestoneId", "must reference a Milestone");
  if (milestone && !entity.goalId) entity.goalId = milestone.goalId;
  if (milestone && entity.goalId !== milestone.goalId)
    fail(field + ".hierarchy", "Goal must own the selected Milestone");
  if (entity.goalId && !findById(projection.goals, entity.goalId))
    fail(field + ".goalId", "must reference a Goal");
}

function validateMilestone(projection, milestone) {
  required(milestone.title, "milestone.title");
  if (!findById(projection.goals, milestone.goalId))
    fail("milestone.goalId", "must reference a Goal");
  if (!milestone.measurement || MEASUREMENT_TYPES.indexOf(milestone.measurement.type) === -1)
    fail("milestone.measurement", "is invalid");
  if (!Number.isInteger(milestone.significance) || milestone.significance < 1)
    fail("milestone.significance", "must be a positive integer");
  if (milestone.measurement.type !== "binary" &&
      (typeof milestone.measurement.target !== "number" || !isFinite(milestone.measurement.target) ||
        milestone.measurement.target <= 0))
    fail("milestone.measurement.target", "must be a positive number");
}

function validateRoutine(projection, routine) {
  required(routine.title, "routine.title");
  required(routine.primarySkill, "routine.primarySkill");
  if (typeof routine.carryover !== "boolean") fail("routine.carryover", "must be true or false");
  resolveGoalMilestoneLinks(projection, routine, "routine");
  dateValue(routine.startDate, "routine.startDate");
  if (routine.endDate) {
    dateValue(routine.endDate, "routine.endDate");
    if (routine.endDate < routine.startDate) fail("routine.endDate", "must not precede startDate");
  }
  if (!Number.isInteger(routine.expectedMinutes) || routine.expectedMinutes < 1)
    fail("routine.expectedMinutes", "must be a positive integer");
  if (!Array.isArray(routine.restDates)) fail("routine.restDates", "must be an array");
  routine.restDates.forEach(function(value) { dateValue(value, "routine.restDates"); });
  if (!routine.schedule || ["weekdays", "interval"].indexOf(routine.schedule.type) === -1)
    fail("routine.schedule", "is invalid");
  if (routine.schedule.type === "weekdays" && (!Array.isArray(routine.schedule.weekdays) ||
      routine.schedule.weekdays.length === 0 || routine.schedule.weekdays.some(function(day) {
        return !Number.isInteger(day) || day < 1 || day > 7;
      }))) fail("routine.schedule.weekdays", "must contain ISO weekdays 1 through 7");
  if (routine.schedule.type === "interval") {
    if (!Number.isInteger(routine.schedule.everyDays) || routine.schedule.everyDays < 1)
      fail("routine.schedule.everyDays", "must be a positive integer");
    dateValue(routine.schedule.anchorDate, "routine.schedule.anchorDate");
  }
}

function occurrenceSnapshot(routine) {
  return {
    title: routine.title,
    expectedMinutes: routine.expectedMinutes,
    primarySkill: routine.primarySkill,
    goalId: routine.goalId || null,
    milestoneId: routine.milestoneId || null
  };
}

function validateTask(projection, task) {
  required(task.title, "task.title");
  required(task.primarySkill, "task.primarySkill");
  required(task.urgency, "task.urgency");
  if (!Number.isInteger(task.estimateMinutes) || task.estimateMinutes < 1)
    fail("task.estimateMinutes", "must be a positive integer");
  if (task.deadline) dateValue(task.deadline, "task.deadline");
  resolveGoalMilestoneLinks(projection, task, "task");
}

function validateProposal(proposal) {
  required(proposal.id, "proposal.id");
  required(proposal.explanation, "proposal.explanation");
  if (["template", "adaptive"].indexOf(proposal.kind) === -1) fail("proposal.kind", "is invalid");
  if (!Array.isArray(proposal.commands)) fail("proposal.commands", "must be an array");
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
    entity = initializeEntity(plan, input.goal, "goal");
    required(entity.primarySkill, "goal.primarySkill");
    required(entity.reason, "goal.reason");
    if (entity.targetDate) dateValue(entity.targetDate, "goal.targetDate");
    entity.status = entity.status || "active";
    if (GOAL_STATUSES.indexOf(entity.status) === -1) fail("goal.status", "is invalid");
    return freeze({ events: [intent("goal.created", entity)] });
  }
  if (input.type === "milestone.create") {
    entity = initializeEntity(plan, input.milestone, "milestone");
    validateMilestone(plan, entity);
    entity.status = "open";
    return freeze({ events: [intent("milestone.created", entity)] });
  }
  if (input.type === "task.create") {
    entity = initializeEntity(plan, input.task, "task");
    validateTask(plan, entity);
    entity.status = "open";
    return freeze({ events: [intent("task.created", entity)] });
  }
  if (input.type === "routine.create") {
    entity = initializeEntity(plan, input.routine, "routine");
    validateRoutine(plan, entity);
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
        events.push(intent("occurrence.created", occurrenceFromRoutine(
          routine, input.dailyXpDate, key, key
        ), key));
      }
      var missedOccurrenceIds = plan.occurrences.filter(function(occurrence) {
        return occurrence.routineId === routine.id && (occurrence.status === "overdue" ||
          (occurrence.status === "open" && occurrence.dailyXpDate < input.dailyXpDate && routine.carryover));
      }).map(function(occurrence) { return occurrence.id; });
      var proposalId = "adaptive:reschedule:" + routine.id;
      var priorProposal = findById(plan.proposals, proposalId);
      var priorMissedIds = priorProposal && Array.isArray(priorProposal.missedOccurrenceIds)
        ? priorProposal.missedOccurrenceIds : [];
      var newMissedCount = missedOccurrenceIds.filter(function(id) {
        return priorMissedIds.indexOf(id) === -1;
      }).length;
      var cooldownEnded = !priorProposal || priorProposal.status !== "dismissed" ||
        priorProposal.dismissedUntil <= input.dailyXpDate;
      var mayOffer = !priorProposal ? missedOccurrenceIds.length >= 3
        : priorProposal.status !== "pending" && cooldownEnded && newMissedCount >= 3;
      if (mayOffer) {
        events.push(intent("proposal.offered", {
          id: proposalId,
          kind: "adaptive",
          status: "pending",
          explanation: "Three unfinished occurrences suggest a smaller daily plan.",
          missedOccurrenceIds: missedOccurrenceIds,
          commands: [{
            type: "routine.edit", id: routine.id, scope: "today_and_future",
            dailyXpDate: input.dailyXpDate,
            changes: { expectedMinutes: Math.max(15, Math.round(routine.expectedMinutes * 0.75)) }
          }]
        }));
      }
    });
    return freeze({ events: events });
  }
  if (input.type === "occurrence.transition") {
    var occurrence = findById(plan.occurrences, input.id);
    if (!occurrence) fail("occurrence.id", "was not found");
    if (OCCURRENCE_STATUSES.indexOf(input.status) === -1 || ["open", "overdue"].indexOf(input.status) !== -1)
      fail("occurrence.status", "is not a terminal action");
    if (!isUntouchedOccurrence(occurrence)) fail("occurrence.status", "is already resolved");
    if (input.status === "rescheduled") {
      dateValue(input.targetDailyXpDate, "occurrence.targetDailyXpDate");
      var replacementKey = "rescheduled:" + encodeURIComponent(occurrence.id) + ":day:" + input.targetDailyXpDate;
      if (plan.occurrences.some(function(item) { return item.occurrenceKey === replacementKey; }))
        fail("occurrence.targetDailyXpDate", "already has this rescheduled occurrence");
      var replacement = clone(occurrence);
      replacement.id = replacementKey;
      replacement.occurrenceKey = replacementKey;
      replacement.dailyXpDate = input.targetDailyXpDate;
      replacement.status = "open";
      replacement.rescheduledFrom = occurrence.id;
      return freeze({ events: [
        intent("occurrence.transitioned", { id: occurrence.id, status: "rescheduled" }),
        intent("occurrence.created", replacement, replacementKey)
      ] });
    }
    if (input.status === "merged") {
      var mergeTarget = findById(plan.occurrences, input.mergeIntoId);
      dateValue(input.dailyXpDate, "occurrence.dailyXpDate");
      if (occurrence.status !== "overdue") fail("occurrence.status", "must be overdue to merge");
      if (!mergeTarget || mergeTarget.status !== "open" || mergeTarget.routineId !== occurrence.routineId ||
          mergeTarget.dailyXpDate !== input.dailyXpDate)
        fail("occurrence.mergeIntoId", "must be today's open equivalent");
      return freeze({ events: [intent("occurrence.merged", {
        id: occurrence.id, mergeIntoId: mergeTarget.id
      })] });
    }
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
    var effectiveRoutine = clone(existingRoutine);
    applyAllowedChanges(effectiveRoutine, changes, [
      "title", "expectedMinutes", "startDate", "endDate", "restDates", "carryover",
      "schedule", "primarySkill", "goalId", "milestoneId"
    ], "routine.changes");
    validateRoutine(plan, effectiveRoutine);
    var occurrenceChanges = occurrenceSnapshot(effectiveRoutine);
    if (input.scope !== "today") {
      effectiveRoutine.revision += 1;
      editEvents.push(intent("routine.updated", effectiveRoutine));
    }
    plan.occurrences.forEach(function(item) {
      var inScope = input.scope === "today" ? item.dailyXpDate === input.dailyXpDate
        : input.scope === "today_and_future" ? item.dailyXpDate >= input.dailyXpDate : true;
      if (item.routineId !== input.id || !isUntouchedOccurrence(item) || !inScope) return;
      if (scheduledOn(effectiveRoutine, item.dailyXpDate))
        editEvents.push(intent("occurrence.updated", { id: item.id, changes: occurrenceChanges }));
      else editEvents.push(intent("occurrence.removed", { id: item.id }));
    });
    var currentKey = routineOccurrenceKey(existingRoutine.id, input.dailyXpDate);
    var currentExists = plan.occurrences.some(function(item) {
      return item.occurrenceKey === currentKey;
    });
    if (!currentExists && scheduledOn(effectiveRoutine, input.dailyXpDate))
      editEvents.push(intent("occurrence.created", occurrenceFromRoutine(
        effectiveRoutine, input.dailyXpDate, currentKey, currentKey
      ), currentKey));
    return freeze({ events: editEvents });
  }
  if (input.type === "proposal.preview" || input.type === "proposal.edit") {
    var preview = clone(input.proposal || {});
    validateProposal(preview);
    var priorProposal = findById(plan.proposals, preview.id);
    if (priorProposal && priorProposal.status === "dismissed" &&
        (!input.dailyXpDate || input.dailyXpDate < priorProposal.dismissedUntil))
      return freeze({ events: [], preview: null, suppressed: true });
    if (input.type === "proposal.edit") {
      applyAllowedChanges(preview, input.changes, ["explanation", "commands"], "proposal.changes");
      validateProposal(preview);
    }
    return freeze({ events: [], preview: preview });
  }
  if (input.type === "proposal.dismiss") {
    required(input.proposalId, "proposal.id");
    if (["template", "adaptive"].indexOf(input.kind) === -1) fail("proposal.kind", "is invalid");
    dateValue(input.dailyXpDate, "proposal.dailyXpDate");
    dateValue(input.dismissedUntil, "proposal.dismissedUntil");
    if (input.dismissedUntil <= input.dailyXpDate)
      fail("proposal.dismissedUntil", "must be after the dismissal day");
    var dismissedProposal = findById(plan.proposals, input.proposalId);
    return freeze({ events: [intent("proposal.dismissed", {
      id: input.proposalId, kind: input.kind, status: "dismissed", dismissedUntil: input.dismissedUntil,
      missedOccurrenceIds: dismissedProposal && dismissedProposal.missedOccurrenceIds
        ? clone(dismissedProposal.missedOccurrenceIds) : []
    })] });
  }
  if (input.type === "proposal.accept") {
    var accepted = clone(input.proposal || {});
    var offeredProposal = findById(plan.proposals, accepted.id);
    validateProposal(accepted);
    var acceptedEvents = [];
    var working = plan;
    accepted.commands.forEach(function(proposalCommand) {
      if (/^proposal\./.test(String(proposalCommand.type || ""))) fail("proposal.commands", "cannot nest proposals");
      var outcome = decide(working, proposalCommand);
      acceptedEvents = acceptedEvents.concat(outcome.events);
      working = projectIntents(working, outcome.events);
    });
    acceptedEvents.push(intent("proposal.accepted", {
      id: accepted.id, kind: accepted.kind, status: "accepted", explanation: accepted.explanation || "",
      missedOccurrenceIds: offeredProposal && offeredProposal.missedOccurrenceIds
        ? clone(offeredProposal.missedOccurrenceIds) : []
    }));
    return freeze({ events: acceptedEvents });
  }
  if (input.type === "task.transition") {
    var task = findById(plan.tasks, input.id);
    if (!task) fail("task.id", "was not found");
    if (["completed", "archived"].indexOf(input.status) === -1) fail("task.status", "is invalid");
    return freeze({ events: [intent("task.transitioned", { id: task.id, status: input.status })] });
  }
  if (input.type === "task.edit") {
    var editableTask = findById(plan.tasks, input.id);
    if (!editableTask) fail("task.id", "was not found");
    var updatedTask = clone(editableTask);
    applyAllowedChanges(updatedTask, input.changes, [
      "title", "estimateMinutes", "urgency", "deadline", "primarySkill", "goalId", "milestoneId"
    ], "task.changes");
    validateTask(plan, updatedTask);
    return freeze({ events: [intent("task.updated", updatedTask)] });
  }
  if (input.type === "goal.transition") {
    var goal = findById(plan.goals, input.id);
    if (!goal) fail("goal.id", "was not found");
    if (GOAL_STATUSES.indexOf(input.status) === -1) fail("goal.status", "is invalid");
    return freeze({ events: [intent("goal.transitioned", { id: goal.id, status: input.status })] });
  }
  if (input.type === "goal.edit") {
    var editableGoal = findById(plan.goals, input.id);
    if (!editableGoal) fail("goal.id", "was not found");
    var updatedGoal = clone(editableGoal);
    applyAllowedChanges(updatedGoal, input.changes, ["title", "targetDate", "primarySkill", "reason"],
      "goal.changes");
    required(updatedGoal.title, "goal.title");
    required(updatedGoal.primarySkill, "goal.primarySkill");
    required(updatedGoal.reason, "goal.reason");
    if (updatedGoal.targetDate) dateValue(updatedGoal.targetDate, "goal.targetDate");
    return freeze({ events: [intent("goal.updated", { id: input.id, changes: clone(input.changes || {}) })] });
  }
  if (input.type === "entity.remove") {
    var collectionName = input.entityType + "s";
    if (["goals", "milestones", "tasks", "routines"].indexOf(collectionName) === -1)
      fail("entityType", "is invalid");
    var removable = findById(plan[collectionName], input.id);
    if (!removable) fail(input.entityType + ".id", "was not found");
    var hasHistory = removable.status !== "open" && removable.status !== "active";
    if (input.entityType === "milestone")
      hasHistory = hasHistory || removable.lockedSignificance !== undefined || removable.progress !== undefined ||
        plan.tasks.some(function(item) { return item.milestoneId === input.id; }) ||
        plan.routines.some(function(item) { return item.milestoneId === input.id; });
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
    var updatedMilestone = clone(editableMilestone);
    applyAllowedChanges(updatedMilestone, input.changes, ["title", "goalId", "measurement", "significance"],
      "milestone.changes");
    if (editableMilestone.lockedSignificance && updatedMilestone.significance !== editableMilestone.significance)
      fail("milestone.significance", "is locked after progress begins");
    if (editableMilestone.progress !== undefined &&
        JSON.stringify(updatedMilestone.measurement) !== JSON.stringify(editableMilestone.measurement))
      fail("milestone.measurement", "is locked after progress begins");
    if (updatedMilestone.goalId !== editableMilestone.goalId &&
        (plan.tasks.some(function(item) { return item.milestoneId === input.id; }) ||
          plan.routines.some(function(item) { return item.milestoneId === input.id; })))
      fail("milestone.goalId", "cannot change while work references the Milestone");
    validateMilestone(plan, updatedMilestone);
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
    } else if (event.type === "planning.occurrence.merged") {
      var merged = findById(next.occurrences, event.payload.id);
      var mergeDestination = findById(next.occurrences, event.payload.mergeIntoId);
      if (merged && mergeDestination) {
        merged.status = "merged";
        mergeDestination.mergedFrom = (mergeDestination.mergedFrom || []).concat([merged.id]);
      }
    } else if (event.type === "planning.occurrence.removed") {
      next.occurrences = next.occurrences.filter(function(item) { return item.id !== event.payload.id; });
    } else if (event.type === "planning.routine.updated") {
      next.routines = replace(next.routines, event.payload);
    } else if (event.type === "planning.occurrence.updated") {
      var updatedOccurrence = findById(next.occurrences, event.payload.id);
      if (updatedOccurrence && isUntouchedOccurrence(updatedOccurrence))
        applyChanges(updatedOccurrence, event.payload.changes);
    } else if (event.type === "planning.proposal.offered" || event.type === "planning.proposal.dismissed" ||
        event.type === "planning.proposal.accepted") {
      next.proposals = replace(next.proposals, event.payload);
    } else if (event.type === "planning.task.transitioned") {
      var transitionedTask = findById(next.tasks, event.payload.id);
      if (transitionedTask) transitionedTask.status = event.payload.status;
    } else if (event.type === "planning.task.updated") {
      next.tasks = replace(next.tasks, event.payload);
    } else if (event.type === "planning.goal.transitioned") {
      var transitionedGoal = findById(next.goals, event.payload.id);
      if (transitionedGoal) transitionedGoal.status = event.payload.status;
    } else if (event.type === "planning.goal.updated") {
      var updatedGoal = findById(next.goals, event.payload.id);
      if (updatedGoal) applyChanges(updatedGoal, event.payload.changes);
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
