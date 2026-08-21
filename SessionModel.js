// Pure Session commands and deterministic projection. The caller owns clocks,
// persistence, and UI; every command carries the UTC instant it observed.

var PROJECTION_SCHEMA_VERSION = 1;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function required(value, field) {
  if (String(value || "").trim() === "") fail(field, "is required");
}

function activeTransitionAt(session) {
  var segments = session.segments || [];
  var current = segments.length > 0 ? segments[segments.length - 1] : null;
  if (current && current.endedAtUtc === null) return current.startedAtUtc;
  return session.lastTransitionAtUtc;
}

function ensureForward(session, atUtc) {
  var at = utcMilliseconds(atUtc, "atUtc");
  if (at < utcMilliseconds(activeTransitionAt(session), "lastTransitionAtUtc"))
    fail("atUtc", "must not precede the last Session transition");
  return at;
}

function sessionSummary(session, atUtc) {
  var focused = session.focusedMilliseconds;
  if (session.status === "running") {
    var current = session.segments[session.segments.length - 1];
    var now = utcMilliseconds(atUtc, "atUtc");
    var started = utcMilliseconds(current.startedAtUtc, "segment.startedAtUtc");
    focused += Math.max(0, now - started);
  }
  return freeze({
    id: session.id,
    status: session.status,
    focusedMilliseconds: focused,
    plannedMilliseconds: session.plannedMinutes === null ? null : session.plannedMinutes * 60000,
    plannedDurationPassed: session.plannedMinutes !== null && focused > session.plannedMinutes * 60000
  });
}

function summaryAt(projection, atUtc) {
  utcMilliseconds(atUtc, "atUtc");
  if (!projection || !projection.activeSession)
    return freeze({ id: null, status: "idle", focusedMilliseconds: 0,
      plannedMilliseconds: null, plannedDurationPassed: false });
  return sessionSummary(projection.activeSession, atUtc);
}

function activePieces(session, atUtc) {
  var inactive = (session.inactiveIntervals || []).map(function(value) {
    return {
      start: utcMilliseconds(value.startedAtUtc, "inactiveIntervals.startedAtUtc"),
      end: utcMilliseconds(value.endedAtUtc, "inactiveIntervals.endedAtUtc")
    };
  }).sort(function(left, right) { return left.start - right.start; });
  var finish = utcMilliseconds(atUtc, "atUtc");
  var pieces = [];
  (session.segments || []).forEach(function(segment) {
    var start = utcMilliseconds(segment.startedAtUtc, "segment.startedAtUtc");
    var end = segment.endedAtUtc === null ? finish : utcMilliseconds(segment.endedAtUtc, "segment.endedAtUtc");
    var cursor = start;
    inactive.forEach(function(gap) {
      if (gap.end <= cursor || gap.start >= end) return;
      if (gap.start > cursor) pieces.push({ start: cursor, end: Math.min(gap.start, end) });
      cursor = Math.max(cursor, gap.end);
    });
    if (cursor < end) pieces.push({ start: cursor, end: end });
  });
  return pieces;
}

function dailySlicesAt(session, atUtc, dateAtUtc) {
  if (typeof dateAtUtc !== "function") fail("dateAtUtc", "must be a function");
  var totals = {};
  function dateAt(milliseconds) {
    var value = String(dateAtUtc(new Date(milliseconds).toISOString()) || "");
    if (!DATE_PATTERN.test(value)) fail("dateAtUtc", "must return YYYY-MM-DD");
    return value;
  }
  function add(date, milliseconds) {
    var prior = Object.prototype.hasOwnProperty.call(totals, date) ? totals[date] : 0;
    Object.defineProperty(totals, date, {
      value: prior + milliseconds, writable: true, enumerable: true, configurable: true
    });
  }
  activePieces(session, atUtc).forEach(function(piece) {
    var cursor = piece.start;
    while (cursor < piece.end) {
      var currentDate = dateAt(cursor);
      if (dateAt(piece.end - 1) === currentDate) {
        add(currentDate, piece.end - cursor);
        break;
      }
      var low = cursor + 1;
      var high = Math.min(piece.end, cursor + 6 * 60 * 60000);
      while (high < piece.end && dateAt(high - 1) === currentDate)
        high = Math.min(piece.end, high + 6 * 60 * 60000);
      while (low < high) {
        var middle = Math.floor((low + high) / 2);
        if (dateAt(middle) === currentDate) low = middle + 1;
        else high = middle;
      }
      add(currentDate, low - cursor);
      cursor = low;
    }
  });
  return freeze(Object.keys(totals).sort().map(function(date) {
    return { dailyXpDate: date, milliseconds: totals[date] };
  }));
}

function validatedDailySlices(values, focusedMilliseconds) {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length === 0) fail("dailySlices", "must be a nonempty array");
  var total = 0;
  var seen = Object.create(null);
  var result = values.map(function(value) {
    if (!value || !DATE_PATTERN.test(String(value.dailyXpDate || "")))
      fail("dailySlices.dailyXpDate", "must be YYYY-MM-DD");
    if (!Number.isInteger(value.milliseconds) || value.milliseconds < 1)
      fail("dailySlices.milliseconds", "must be a positive integer");
    if (seen[value.dailyXpDate]) fail("dailySlices.dailyXpDate", "must be unique");
    seen[value.dailyXpDate] = true;
    total += value.milliseconds;
    return { dailyXpDate: value.dailyXpDate, milliseconds: value.milliseconds };
  });
  if (total !== focusedMilliseconds) fail("dailySlices", "must equal focused Session duration");
  return result;
}

function primaryDailyXpDate(slices) {
  if (slices.length === 0) return null;
  return slices.slice().sort(function(left, right) {
    return right.milliseconds - left.milliseconds || left.dailyXpDate.localeCompare(right.dailyXpDate);
  })[0].dailyXpDate;
}

function validatedInactiveIntervals(session, values, finishAtUtc) {
  if (values === undefined) return { intervals: [], milliseconds: 0 };
  if (!Array.isArray(values)) fail("inactiveIntervals", "must be an array");
  var previousEnd = null;
  var total = 0;
  var intervals = values.slice().sort(function(left, right) {
    return String(left.startedAtUtc).localeCompare(String(right.startedAtUtc));
  }).map(function(value) {
    var started = utcMilliseconds(value && value.startedAtUtc, "inactiveIntervals.startedAtUtc");
    var ended = utcMilliseconds(value && value.endedAtUtc, "inactiveIntervals.endedAtUtc");
    if (ended <= started) fail("inactiveIntervals", "must have positive duration");
    if (previousEnd !== null && started < previousEnd) fail("inactiveIntervals", "must not overlap");
    var covered = session.segments.some(function(segment) {
      var segmentStart = utcMilliseconds(segment.startedAtUtc, "segment.startedAtUtc");
      var segmentEnd = segment.endedAtUtc === null
        ? utcMilliseconds(finishAtUtc, "atUtc") : utcMilliseconds(segment.endedAtUtc, "segment.endedAtUtc");
      return started >= segmentStart && ended <= segmentEnd;
    });
    if (!covered) fail("inactiveIntervals", "must fall within a running interval");
    previousEnd = ended;
    total += ended - started;
    return { startedAtUtc: value.startedAtUtc, endedAtUtc: value.endedAtUtc };
  });
  return { intervals: intervals, milliseconds: total };
}

function competitiveUsedOn(state, dailyXpDate) {
  return (state.sessions || []).reduce(function(total, session) {
    var values = session.competitiveByDailyXpDate || {};
    return total + (Object.prototype.hasOwnProperty.call(values, dailyXpDate) ? values[dailyXpDate] : 0);
  }, 0);
}

function competitiveAllocation(state, slices, budgetMilliseconds) {
  var remainingBudget = budgetMilliseconds;
  var byDate = {};
  var capExcluded = 0;
  slices.slice().sort(function(left, right) {
    return left.dailyXpDate.localeCompare(right.dailyXpDate);
  }).forEach(function(slice) {
    var beforeCap = Math.min(slice.milliseconds, remainingBudget);
    remainingBudget -= beforeCap;
    var available = Math.max(0, 12 * 60 * 60000 - competitiveUsedOn(state, slice.dailyXpDate));
    var accepted = Math.min(beforeCap, available);
    Object.defineProperty(byDate, slice.dailyXpDate, {
      value: accepted, writable: true, enumerable: true, configurable: true
    });
    capExcluded += beforeCap - accepted;
  });
  return { byDate: byDate, capExcludedMilliseconds: capExcluded };
}

function findSession(sessions, id) {
  for (var i = 0; i < sessions.length; i += 1) if (sessions[i].id === id) return sessions[i];
  return null;
}

function validatedClosedSegments(values) {
  if (!Array.isArray(values) || values.length === 0) fail("segments", "must be a nonempty array");
  var previousEnd = null;
  var focused = 0;
  var segments = values.map(function(value) {
    var started = utcMilliseconds(value && value.startedAtUtc, "segments.startedAtUtc");
    var ended = utcMilliseconds(value && value.endedAtUtc, "segments.endedAtUtc");
    if (ended <= started) fail("segments", "must have positive duration");
    if (previousEnd !== null && started < previousEnd) fail("segments", "must not overlap");
    previousEnd = ended;
    focused += ended - started;
    return { startedAtUtc: value.startedAtUtc, endedAtUtc: value.endedAtUtc };
  });
  return { segments: segments, focusedMilliseconds: focused };
}

function revisedSessionFields(session, changes) {
  var revised = {
    taskId: session.taskId,
    primarySkill: session.primarySkill,
    plannedMinutes: session.plannedMinutes
  };
  Object.keys(changes || {}).forEach(function(key) {
    if (["taskId", "primarySkill", "plannedMinutes"].indexOf(key) === -1)
      fail("changes", "cannot change " + key);
    revised[key] = changes[key];
  });
  if (revised.taskId !== null) required(revised.taskId, "changes.taskId");
  required(revised.primarySkill, "changes.primarySkill");
  if (revised.plannedMinutes !== null &&
      (!Number.isInteger(revised.plannedMinutes) || revised.plannedMinutes < 1))
    fail("changes.plannedMinutes", "must be null or a positive integer");
  return revised;
}

function correctionOutcome(state, input) {
  var session = findSession(state.sessions || [], input.id);
  if (!session || session.status !== "finished") fail("session.id", "must reference a finished Session");
  var changedAt = utcMilliseconds(input.atUtc, "atUtc");
  if (changedAt < utcMilliseconds(session.finishedAtUtc, "session.finishedAtUtc"))
    fail("atUtc", "must not precede Session finish");
  var revised = validatedClosedSegments(input.segments);
  var revisedFields = revisedSessionFields(session, input.changes);
  var slices = validatedDailySlices(input.dailySlices, revised.focusedMilliseconds);
  var budget = revised.focusedMilliseconds;
  if (revisedFields.plannedMinutes !== null && session.plannedDurationDecision === "exclude-overtime")
    budget = Math.min(budget, revisedFields.plannedMinutes * 60000);
  var otherSessions = state.sessions.filter(function(item) { return item.id !== session.id; });
  var allocation = competitiveAllocation({ sessions: otherSessions }, slices, budget);
  var competitive = budget - allocation.capExcludedMilliseconds;
  var competitiveDelta = competitive - session.competitiveMilliseconds;
  if (competitiveDelta !== 0 && input.competitiveChangeConfirmed !== true)
    return freeze({ events: [], confirmation: {
      reasons: ["correction"],
      focusedDeltaMilliseconds: revised.focusedMilliseconds - session.focusedMilliseconds,
      competitiveDeltaMilliseconds: competitiveDelta
    } });
  var kind = changedAt <= utcMilliseconds(session.finishedAtUtc, "session.finishedAtUtc") + 24 * 60 * 60000
    ? "correction" : "adjustment";
  return freeze({ events: [intent(kind === "correction" ? "corrected" : "adjusted", {
    id: session.id,
    atUtc: input.atUtc,
    kind: kind,
    taskId: revisedFields.taskId,
    primarySkill: revisedFields.primarySkill,
    plannedMinutes: revisedFields.plannedMinutes,
    segments: revised.segments,
    focusedMilliseconds: revised.focusedMilliseconds,
    competitiveMilliseconds: competitive,
    competitiveByDailyXpDate: allocation.byDate,
    plannedDurationDecision: input.plannedDurationDecision || null,
    dailySlices: slices,
    dailyXpDate: primaryDailyXpDate(slices),
    competitiveDeltaMilliseconds: competitiveDelta
  })] });
}

function finishOutcome(state, input) {
  var session = state.activeSession;
  var rawFocused = sessionSummary(session, input.atUtc).focusedMilliseconds;
  var inactivityValues = (session.inactiveIntervals || []).concat(input.inactiveIntervals || []);
  var inactivity = validatedInactiveIntervals(session, inactivityValues, input.atUtc);
  var inactivityDecisions = ["include", "exclude"];
  var missingReasons = [];
  if (session.pendingInactivityStartedAtUtc) missingReasons.push("inactivity");
  if (inactivity.milliseconds > 0 && inactivityDecisions.indexOf(input.inactivityDecision) === -1)
    if (missingReasons.indexOf("inactivity") === -1) missingReasons.push("inactivity");
  var focused = rawFocused;
  var adjustments = [];
  if (inactivity.milliseconds > 0 && input.inactivityDecision === "exclude") {
    focused -= inactivity.milliseconds;
    adjustments.push({ reason: "inactivity", excludedMilliseconds: inactivity.milliseconds });
  }
  var plannedMilliseconds = session.plannedMinutes === null ? null : session.plannedMinutes * 60000;
  var overtime = plannedMilliseconds === null ? 0 : Math.max(0, focused - plannedMilliseconds);
  var decisions = ["include-overtime", "exclude-overtime"];
  if (overtime > 0 && decisions.indexOf(input.plannedDurationDecision) === -1)
    missingReasons.push("planned-duration");
  var slices = validatedDailySlices(input.dailySlices, focused);
  var competitive = focused;
  if (overtime > 0 && input.plannedDurationDecision === "exclude-overtime") {
    competitive -= overtime;
    adjustments.push({ reason: "planned-duration", excludedMilliseconds: overtime });
  }
  var allocation = competitiveAllocation(state, slices, competitive);
  if (allocation.capExcludedMilliseconds > 0 && input.dailyCapAcknowledged !== true)
    missingReasons.push("daily-cap");
  if (missingReasons.length > 0)
    return freeze({ events: [], confirmation: {
      reasons: missingReasons, focusedMilliseconds: focused,
      plannedMilliseconds: plannedMilliseconds, overtimeMilliseconds: overtime,
      dailyCapExcludedMilliseconds: allocation.capExcludedMilliseconds
    } });
  if (allocation.capExcludedMilliseconds > 0)
    adjustments.push({ reason: "daily-cap", excludedMilliseconds: allocation.capExcludedMilliseconds });
  competitive -= allocation.capExcludedMilliseconds;
  return freeze({ events: [intent("finished", {
    id: session.id,
    atUtc: input.atUtc,
    focusedMilliseconds: focused,
    competitiveMilliseconds: competitive,
    competitiveByDailyXpDate: allocation.byDate,
    rawFocusedMilliseconds: rawFocused,
    inactiveIntervals: inactivity.intervals,
    dailySlices: slices,
    dailyXpDate: primaryDailyXpDate(slices),
    competitiveAdjustments: adjustments
  })] });
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
  if (input.type === "session.start") {
    if (state.activeSession) fail("activeSession", "already exists");
    var session = clone(input.session || {});
    required(session.id, "session.id");
    required(session.primarySkill, "session.primarySkill");
    utcMilliseconds(session.startedAtUtc, "session.startedAtUtc");
    if (session.taskId !== null && session.taskId !== undefined) required(session.taskId, "session.taskId");
    else session.taskId = null;
    if (session.plannedMinutes !== null && session.plannedMinutes !== undefined &&
        (!Number.isInteger(session.plannedMinutes) || session.plannedMinutes < 1))
      fail("session.plannedMinutes", "must be null or a positive integer");
    if (session.plannedMinutes === undefined) session.plannedMinutes = null;
    if (state.sessions.some(function(item) { return item.id === session.id; }))
      fail("session.id", "already exists");
    return freeze({ events: [intent("started", {
      id: session.id,
      taskId: session.taskId,
      primarySkill: session.primarySkill,
      plannedMinutes: session.plannedMinutes,
      startedAtUtc: session.startedAtUtc
    })] });
  }
  if (input.type === "session.pause") {
    if (!state.activeSession || state.activeSession.status !== "running")
      fail("activeSession", "must be running");
    ensureForward(state.activeSession, input.atUtc);
    return freeze({ events: [intent("paused", { id: state.activeSession.id, atUtc: input.atUtc })] });
  }
  if (input.type === "session.resume") {
    if (!state.activeSession || state.activeSession.status !== "paused")
      fail("activeSession", "must be paused");
    ensureForward(state.activeSession, input.atUtc);
    return freeze({ events: [intent("resumed", { id: state.activeSession.id, atUtc: input.atUtc })] });
  }
  if (input.type === "session.finish") {
    if (!state.activeSession || ["running", "paused"].indexOf(state.activeSession.status) === -1)
      fail("activeSession", "must be running or paused");
    ensureForward(state.activeSession, input.atUtc);
    return finishOutcome(state, input);
  }
  if (input.type === "session.change_task") {
    if (!state.activeSession) fail("activeSession", "is required");
    ensureForward(state.activeSession, input.atUtc);
    if (input.taskId !== null) required(input.taskId, "taskId");
    return freeze({ events: [intent("task.changed", {
      id: state.activeSession.id, taskId: input.taskId, atUtc: input.atUtc
    })] });
  }
  if (input.type === "session.discard") {
    if (!state.activeSession) fail("activeSession", "is required");
    ensureForward(state.activeSession, input.atUtc);
    return freeze({ events: [intent("discarded", { id: state.activeSession.id, atUtc: input.atUtc })] });
  }
  if (input.type === "session.correct") return correctionOutcome(state, input);
  if (input.type === "session.inactivity.detect") {
    if (!state.activeSession || state.activeSession.status !== "running") return freeze({ events: [] });
    ensureForward(state.activeSession, input.atUtc);
    if (state.activeSession.pendingInactivityStartedAtUtc) return freeze({ events: [] });
    return freeze({ events: [intent("inactivity.detected", {
      id: state.activeSession.id, atUtc: input.atUtc
    })] });
  }
  if (input.type === "session.inactivity.return") {
    if (!state.activeSession || !state.activeSession.pendingInactivityStartedAtUtc ||
        state.activeSession.pendingInactivityEndedAtUtc) return freeze({ events: [] });
    ensureForward(state.activeSession, input.atUtc);
    return freeze({ events: [intent("inactivity.returned", {
      id: state.activeSession.id, atUtc: input.atUtc
    })] });
  }
  if (input.type === "session.inactivity.resolve") {
    if (!state.activeSession || !state.activeSession.pendingInactivityStartedAtUtc ||
        !state.activeSession.pendingInactivityEndedAtUtc)
      fail("activeSession.inactivity", "has no returned inactivity confirmation");
    ensureForward(state.activeSession, input.atUtc);
    if (["include", "exclude"].indexOf(input.decision) === -1)
      fail("decision", "must be include or exclude");
    return freeze({ events: [intent("inactivity.resolved", {
      id: state.activeSession.id,
      startedAtUtc: state.activeSession.pendingInactivityStartedAtUtc,
      endedAtUtc: state.activeSession.pendingInactivityEndedAtUtc,
      decision: input.decision
    })] });
  }
  fail("command.type", "is unsupported");
}

function closeRunningSegment(session, atUtc) {
  var current = session.segments[session.segments.length - 1];
  if (!current || current.endedAtUtc !== null) return;
  current.endedAtUtc = atUtc;
  session.focusedMilliseconds += utcMilliseconds(atUtc, "atUtc") -
    utcMilliseconds(current.startedAtUtc, "segment.startedAtUtc");
}

function projectIntents(projection, intents) {
  var next = clone(projection || emptyProjection());
  (intents || []).forEach(function(event) {
    if (event.type === "session.selection.changed") next.selection = clone(event.payload);
    else if (event.type === "session.selection.reminder.due" && next.selection)
      next.selection.reminderStatus = "due";
    else if (event.type === "session.selection.reminder.dismissed" && next.selection)
      next.selection.reminderStatus = "dismissed";
    else if (event.type === "session.started") {
      next.activeSession = {
        id: event.payload.id,
        taskId: event.payload.taskId,
        primarySkill: event.payload.primarySkill,
        plannedMinutes: event.payload.plannedMinutes,
        startedAtUtc: event.payload.startedAtUtc,
        lastTransitionAtUtc: event.payload.startedAtUtc,
        status: "running",
        focusedMilliseconds: 0,
        segments: [{ startedAtUtc: event.payload.startedAtUtc, endedAtUtc: null }],
        inactiveIntervals: [],
        pendingInactivityStartedAtUtc: null,
        pendingInactivityEndedAtUtc: null
      };
      if (next.selection && event.payload.taskId !== null && next.selection.taskId === event.payload.taskId)
        next.selection.reminderStatus = "satisfied";
    } else if (event.type === "session.paused" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      closeRunningSegment(next.activeSession, event.payload.atUtc);
      next.activeSession.status = "paused";
      next.activeSession.lastTransitionAtUtc = event.payload.atUtc;
    } else if (event.type === "session.resumed" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      next.activeSession.status = "running";
      next.activeSession.lastTransitionAtUtc = event.payload.atUtc;
      next.activeSession.segments.push({ startedAtUtc: event.payload.atUtc, endedAtUtc: null });
    } else if (event.type === "session.finished" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      if (next.activeSession.status === "running") closeRunningSegment(next.activeSession, event.payload.atUtc);
      if (event.payload.focusedMilliseconds !== undefined)
        next.activeSession.focusedMilliseconds = event.payload.focusedMilliseconds;
      next.activeSession.competitiveMilliseconds = event.payload.competitiveMilliseconds === undefined
        ? next.activeSession.focusedMilliseconds : event.payload.competitiveMilliseconds;
      next.activeSession.rawFocusedMilliseconds = event.payload.rawFocusedMilliseconds === undefined
        ? next.activeSession.focusedMilliseconds : event.payload.rawFocusedMilliseconds;
      next.activeSession.inactiveIntervals = clone(event.payload.inactiveIntervals || []);
      next.activeSession.competitiveByDailyXpDate = clone(event.payload.competitiveByDailyXpDate || {});
      next.activeSession.dailySlices = clone(event.payload.dailySlices || []);
      next.activeSession.dailyXpDate = event.payload.dailyXpDate || null;
      next.activeSession.competitiveAdjustments = clone(event.payload.competitiveAdjustments || []);
      next.activeSession.plannedDurationDecision = event.payload.plannedDurationDecision || null;
      next.activeSession.status = "finished";
      next.activeSession.finishedAtUtc = event.payload.atUtc;
      next.activeSession.lastTransitionAtUtc = event.payload.atUtc;
      next.sessions.push(next.activeSession);
      next.activeSession = null;
    } else if (event.type === "session.task.changed" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      next.activeSession.taskId = event.payload.taskId;
      next.activeSession.lastTransitionAtUtc = event.payload.atUtc;
    } else if (event.type === "session.discarded" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      if (next.activeSession.status === "running") closeRunningSegment(next.activeSession, event.payload.atUtc);
      next.activeSession.status = "discarded";
      next.activeSession.discardedAtUtc = event.payload.atUtc;
      next.activeSession.lastTransitionAtUtc = event.payload.atUtc;
      next.sessions.push(next.activeSession);
      next.activeSession = null;
    } else if ((event.type === "session.corrected" || event.type === "session.adjusted")) {
      var revisedSession = findSession(next.sessions, event.payload.id);
      if (revisedSession) {
        revisedSession.segments = clone(event.payload.segments);
        revisedSession.taskId = event.payload.taskId;
        revisedSession.primarySkill = event.payload.primarySkill;
        revisedSession.plannedMinutes = event.payload.plannedMinutes;
        revisedSession.focusedMilliseconds = event.payload.focusedMilliseconds;
        revisedSession.competitiveMilliseconds = event.payload.competitiveMilliseconds;
        revisedSession.competitiveByDailyXpDate = clone(event.payload.competitiveByDailyXpDate);
        revisedSession.dailySlices = clone(event.payload.dailySlices);
        revisedSession.dailyXpDate = event.payload.dailyXpDate;
        revisedSession.lastRevisionKind = event.payload.kind;
        next.adjustments.push(clone(event.payload));
      }
    } else if (event.type === "session.inactivity.detected" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      next.activeSession.pendingInactivityStartedAtUtc = event.payload.atUtc;
      next.activeSession.pendingInactivityEndedAtUtc = null;
    } else if (event.type === "session.inactivity.returned" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      next.activeSession.pendingInactivityEndedAtUtc = event.payload.atUtc;
    } else if (event.type === "session.inactivity.resolved" && next.activeSession &&
        next.activeSession.id === event.payload.id) {
      if (event.payload.decision === "exclude") next.activeSession.inactiveIntervals.push({
        startedAtUtc: event.payload.startedAtUtc, endedAtUtc: event.payload.endedAtUtc
      });
      next.activeSession.pendingInactivityStartedAtUtc = null;
      next.activeSession.pendingInactivityEndedAtUtc = null;
    }
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
    summaryAt: summaryAt,
    dailySlicesAt: dailySlicesAt,
    projectIntents: projectIntents,
    project: project
  };
}
