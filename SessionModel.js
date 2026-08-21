// Pure Session commands and deterministic projection. The caller owns clocks,
// persistence, and UI; every command carries the UTC instant it observed.

var PROJECTION_SCHEMA_VERSION = 1;

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
    selection: null,
    activeSession: null,
    sessions: [],
    adjustments: []
  });
}

function utcMilliseconds(value, field) {
  if (typeof value !== "string" || !/Z$/.test(value)) fail(field, "must be a canonical UTC instant");
  var date = new Date(value);
  if (isNaN(date.getTime()) || date.toISOString() !== value)
    fail(field, "must be a canonical UTC instant");
  return date.getTime();
}

function addMinutes(value, minutes) {
  return new Date(utcMilliseconds(value, "selectedAtUtc") + minutes * 60000).toISOString();
}

function intent(name, payload) {
  return { type: "session." + name, occurrenceKey: null, payload: clone(payload) };
}

function decide(projection, command) {
  var state = projection || emptyProjection();
  var input = command || {};
  if (input.type === "selection.change") {
    if (String(input.taskId || "") === "") fail("taskId", "is required");
    utcMilliseconds(input.selectedAtUtc, "selectedAtUtc");
    if (!Number.isInteger(input.reminderDelayMinutes) || input.reminderDelayMinutes < 0)
      fail("reminderDelayMinutes", "must be a nonnegative integer");
    return freeze({ events: [intent("selection.changed", {
      taskId: input.taskId,
      selectedAtUtc: input.selectedAtUtc,
      reminderDueAtUtc: addMinutes(input.selectedAtUtc, input.reminderDelayMinutes),
      reminderStatus: "scheduled"
    })] });
  }
  if (input.type === "selection.reminder.due") {
    utcMilliseconds(input.atUtc, "atUtc");
    if (!state.selection || state.selection.reminderStatus !== "scheduled" ||
        utcMilliseconds(input.atUtc, "atUtc") < utcMilliseconds(state.selection.reminderDueAtUtc, "reminderDueAtUtc"))
      return freeze({ events: [] });
    return freeze({ events: [intent("selection.reminder.due", { atUtc: input.atUtc })] });
  }
  if (input.type === "selection.reminder.dismiss") {
    utcMilliseconds(input.atUtc, "atUtc");
    if (!state.selection || state.selection.reminderStatus !== "due") return freeze({ events: [] });
    return freeze({ events: [intent("selection.reminder.dismissed", { atUtc: input.atUtc })] });
  }
  fail("command.type", "is unsupported");
}

function projectIntents(projection, intents) {
  var next = clone(projection || emptyProjection());
  (intents || []).forEach(function(event) {
    if (event.type === "session.selection.changed") next.selection = clone(event.payload);
    else if (event.type === "session.selection.reminder.due" && next.selection)
      next.selection.reminderStatus = "due";
    else if (event.type === "session.selection.reminder.dismissed" && next.selection)
      next.selection.reminderStatus = "dismissed";
  });
  return freeze(next);
}

function project(events) {
  var intents = (events || []).filter(function(event) { return /^session\./.test(event.type); }).map(function(event) {
    return { type: event.type, payload: event.payload, occurrenceKey: event.occurrenceKey };
  });
  return projectIntents(emptyProjection(), intents);
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
