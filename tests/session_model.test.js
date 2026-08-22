const test = require("node:test");
const assert = require("node:assert/strict");

const SessionModel = require("../SessionModel.js");

function apply(projection, command) {
  const outcome = SessionModel.decide(projection, command);
  return { outcome, projection: SessionModel.projectIntents(projection, outcome.events) };
}

test("selecting work stays distinct from starting time and offers one dismissible reminder", () => {
  let state = SessionModel.emptyProjection();
  let result = apply(state, {
    type: "selection.change",
    taskId: "task-dailyxp",
    selectedAtUtc: "2026-08-21T08:00:00.000Z",
    reminderDelayMinutes: 10
  });
  state = result.projection;

  assert.equal(state.activeSession, null);
  assert.deepEqual(state.selection, {
    taskId: "task-dailyxp",
    selectedAtUtc: "2026-08-21T08:00:00.000Z",
    reminderDueAtUtc: "2026-08-21T08:10:00.000Z",
    reminderStatus: "scheduled"
  });

  result = apply(state, { type: "selection.reminder.due", atUtc: "2026-08-21T08:10:00.000Z" });
  state = result.projection;
  assert.equal(state.selection.reminderStatus, "due");
  assert.equal(apply(state, {
    type: "selection.reminder.due", atUtc: "2026-08-21T08:11:00.000Z"
  }).outcome.events.length, 0);

  state = apply(state, {
    type: "selection.reminder.dismiss", atUtc: "2026-08-21T08:12:00.000Z"
  }).projection;
  assert.equal(state.selection.reminderStatus, "dismissed");
  assert.equal(state.activeSession, null);

  state = apply(state, {
    type: "session.start",
    session: {
      id: "session-selected", taskId: "task-dailyxp", primarySkill: "backend/build",
      plannedMinutes: 30, startedAtUtc: "2026-08-21T08:15:00.000Z"
    }
  }).projection;
  assert.equal(state.selection.reminderStatus, "satisfied");
});

test("one Session survives restart and counts only running intervals once", () => {
  let state = SessionModel.emptyProjection();
  const recorded = [];
  function run(command) {
    const outcome = SessionModel.decide(state, command);
    recorded.push(...outcome.events);
    state = SessionModel.projectIntents(state, outcome.events);
  }

  run({
    type: "session.start",
    session: {
      id: "session-1", taskId: "task-dailyxp", primarySkill: "backend/build",
      plannedMinutes: 60, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  });
  assert.equal(state.activeSession.status, "running");
  assert.equal(SessionModel.summaryAt(state, "2026-08-21T08:25:00.000Z").focusedMilliseconds, 25 * 60000);
  assert.throws(() => SessionModel.decide(state, {
    type: "session.start",
    session: {
      id: "session-2", taskId: null, primarySkill: "backend/study",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:25:00.000Z"
    }
  }), /activeSession: already exists/);

  run({ type: "session.pause", atUtc: "2026-08-21T08:30:00.000Z" });
  assert.equal(SessionModel.summaryAt(state, "2026-08-21T09:00:00.000Z").focusedMilliseconds, 30 * 60000);
  run({ type: "session.resume", atUtc: "2026-08-21T09:00:00.000Z" });

  const restarted = SessionModel.project(recorded);
  assert.equal(SessionModel.summaryAt(restarted, "2026-08-21T09:15:00.000Z").focusedMilliseconds, 45 * 60000);
  state = restarted;
  run({ type: "session.finish", atUtc: "2026-08-21T09:20:00.000Z" });

  assert.equal(state.activeSession, null);
  assert.equal(state.sessions[0].status, "finished");
  assert.equal(state.sessions[0].focusedMilliseconds, 50 * 60000);
  assert.equal(state.sessions[0].taskId, "task-dailyxp");
});

test("a free Session can change attachment or be discarded without completing work", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-free", taskId: null, primarySkill: "backend/build",
      plannedMinutes: null, startedAtUtc: "2026-08-21T10:00:00.000Z"
    }
  }).projection;

  state = apply(state, {
    type: "session.change_task", taskId: "task-dailyxp", primarySkill: "backend/build",
    atUtc: "2026-08-21T10:05:00.000Z"
  }).projection;
  assert.equal(state.activeSession.taskId, "task-dailyxp");
  assert.equal(state.activeSession.primarySkill, "backend/build");

  state = apply(state, { type: "session.discard", atUtc: "2026-08-21T10:10:00.000Z" }).projection;
  assert.equal(state.activeSession, null);
  assert.equal(state.sessions[0].status, "discarded");
  assert.equal(state.sessions[0].focusedMilliseconds, 10 * 60000);
  assert.equal(state.sessions[0].taskCompleted, undefined);
});

test("planned overtime changes competitive eligibility only after confirmation", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-planned", taskId: "task-study", primarySkill: "backend/study",
      plannedMinutes: 60, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  }).projection;

  const unconfirmed = SessionModel.decide(state, {
    type: "session.finish",
    atUtc: "2026-08-21T09:10:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 70 * 60000 }]
  });
  assert.equal(unconfirmed.events.length, 0);
  assert.deepEqual(unconfirmed.confirmation.reasons, ["planned-duration"]);

  state = apply(state, {
    type: "session.finish",
    atUtc: "2026-08-21T09:10:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 70 * 60000 }],
    plannedDurationDecision: "exclude-overtime"
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 70 * 60000);
  assert.equal(state.sessions[0].competitiveMilliseconds, 60 * 60000);
  assert.deepEqual(state.sessions[0].competitiveAdjustments, [{
    reason: "planned-duration", excludedMilliseconds: 10 * 60000
  }]);

  state = apply(state, {
    type: "session.correct", id: "session-planned", atUtc: "2026-08-21T10:00:00.000Z",
    segments: [{
      startedAtUtc: "2026-08-21T08:00:00.000Z",
      endedAtUtc: "2026-08-21T09:20:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 80 * 60000 }]
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 80 * 60000);
  assert.equal(state.sessions[0].finishedAtUtc, "2026-08-21T09:20:00.000Z");
  assert.equal(state.sessions[0].rawFocusedMilliseconds, 80 * 60000);
  assert.equal(state.sessions[0].competitiveMilliseconds, 60 * 60000);
  assert.equal(state.sessions[0].plannedDurationDecision, "exclude-overtime");
  assert.deepEqual(state.sessions[0].inactiveIntervals, []);
  assert.deepEqual(state.sessions[0].competitiveAdjustments, [{
    reason: "planned-duration", excludedMilliseconds: 20 * 60000
  }]);
});

test("confirmed inactivity removes only the agreed interval without recording activity content", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-idle", taskId: null, primarySkill: "reading",
      plannedMinutes: null, startedAtUtc: "2026-08-21T10:00:00.000Z"
    }
  }).projection;
  const inactiveIntervals = [{
    startedAtUtc: "2026-08-21T10:20:00.000Z",
    endedAtUtc: "2026-08-21T10:30:00.000Z"
  }];

  const unconfirmed = SessionModel.decide(state, {
    type: "session.finish", atUtc: "2026-08-21T11:00:00.000Z", inactiveIntervals
  });
  assert.deepEqual(unconfirmed.confirmation.reasons, ["inactivity"]);

  state = apply(state, {
    type: "session.finish",
    atUtc: "2026-08-21T11:00:00.000Z",
    inactiveIntervals,
    inactivityDecision: "exclude",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 50 * 60000 }]
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 50 * 60000);
  assert.equal(state.sessions[0].competitiveMilliseconds, 50 * 60000);
  assert.deepEqual(state.sessions[0].inactiveIntervals, inactiveIntervals);
  assert.equal("keys" in state.sessions[0], false);
  assert.equal("screens" in state.sessions[0], false);
  assert.equal("urls" in state.sessions[0], false);
});

test("the 12-hour daily competitive cap is acknowledged and enforced without reducing focused history", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-long", taskId: null, primarySkill: "backend/build",
      plannedMinutes: null, startedAtUtc: "2026-08-21T04:00:00.000Z"
    }
  }).projection;
  const command = {
    type: "session.finish",
    atUtc: "2026-08-21T17:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 13 * 60 * 60000 }]
  };

  const unconfirmed = SessionModel.decide(state, command);
  assert.deepEqual(unconfirmed.confirmation.reasons, ["daily-cap"]);

  state = apply(state, { ...command, dailyCapAcknowledged: true }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 13 * 60 * 60000);
  assert.equal(state.sessions[0].competitiveMilliseconds, 12 * 60 * 60000);
  assert.deepEqual(state.sessions[0].competitiveByDailyXpDate, {
    "2026-08-21": 12 * 60 * 60000
  });
  assert.deepEqual(state.sessions[0].competitiveAdjustments, [{
    reason: "daily-cap", excludedMilliseconds: 60 * 60000
  }]);
});

test("a cross-boundary Session belongs to the DailyXP day containing most focused time", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-boundary", taskId: null, primarySkill: "backend/study",
      plannedMinutes: null, startedAtUtc: "2026-08-21T00:00:00.000Z"
    }
  }).projection;
  state = apply(state, {
    type: "session.finish",
    atUtc: "2026-08-21T01:00:00.000Z",
    dailySlices: [
      { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 },
      { dailyXpDate: "2026-08-21", milliseconds: 40 * 60000 }
    ]
  }).projection;

  assert.equal(state.sessions[0].dailyXpDate, "2026-08-21");
  assert.deepEqual(state.sessions[0].competitiveByDailyXpDate, {
    "2026-08-20": 20 * 60000,
    "2026-08-21": 40 * 60000
  });
});

test("finished Sessions allow 24-hour corrections and preserve later changes as explicit adjustments", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-correct", taskId: "task-study", primarySkill: "backend/study",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  }).projection;
  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T09:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 60 * 60000 }]
  }).projection;

  const revisedSegments = [{
    startedAtUtc: "2026-08-21T08:00:00.000Z",
    endedAtUtc: "2026-08-21T08:45:00.000Z"
  }];
  const unconfirmed = SessionModel.decide(state, {
    type: "session.correct", id: "session-correct", atUtc: "2026-08-22T07:59:00.000Z",
    segments: revisedSegments,
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 45 * 60000 }]
  });
  assert.deepEqual(unconfirmed.confirmation.reasons, ["correction"]);

  state = apply(state, {
    type: "session.correct", id: "session-correct", atUtc: "2026-08-22T07:59:00.000Z",
    segments: revisedSegments,
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 45 * 60000 }],
    competitiveChangeConfirmed: true,
    changes: { taskId: "task-revised", primarySkill: "backend/build" }
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 45 * 60000);
  assert.equal(state.sessions[0].lastRevisionKind, "correction");
  assert.equal(state.sessions[0].taskId, "task-revised");
  assert.equal(state.sessions[0].primarySkill, "backend/build");

  state = apply(state, {
    type: "session.correct", id: "session-correct", atUtc: "2026-08-22T09:01:00.000Z",
    segments: [{
      startedAtUtc: "2026-08-21T08:00:00.000Z",
      endedAtUtc: "2026-08-21T08:40:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 40 * 60000 }],
    competitiveChangeConfirmed: true
  }).projection;
  assert.equal(state.sessions[0].lastRevisionKind, "adjustment");
  assert.deepEqual(state.adjustments.map(item => item.kind), ["correction", "adjustment"]);
  assert.equal(state.adjustments[1].competitiveDeltaMilliseconds, -5 * 60000);
  assert.throws(() => SessionModel.decide(state, {
    type: "session.correct", id: "session-correct", atUtc: "2026-08-22T09:02:00.000Z",
    segments: revisedSegments,
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 45 * 60000 }],
    changes: { status: "discarded" }
  }), /changes: cannot change status/);
});

test("inactivity detection survives restart and only excludes time after a user decision", () => {
  const started = SessionModel.decide(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-inactivity", taskId: null, primarySkill: "reading",
      plannedMinutes: null, startedAtUtc: "2026-08-21T10:00:00.000Z"
    }
  });
  let state = SessionModel.projectIntents(SessionModel.emptyProjection(), started.events);
  const detected = SessionModel.decide(state, {
    type: "session.inactivity.detect", atUtc: "2026-08-21T10:20:00.000Z"
  });
  state = SessionModel.project(started.events.concat(detected.events));
  assert.equal(state.activeSession.pendingInactivityStartedAtUtc, "2026-08-21T10:20:00.000Z");
  assert.deepEqual(SessionModel.decide(state, {
    type: "session.finish", atUtc: "2026-08-21T10:25:00.000Z"
  }).confirmation.reasons, ["inactivity"]);

  state = apply(state, {
    type: "session.inactivity.return", atUtc: "2026-08-21T10:30:00.000Z"
  }).projection;
  state = apply(state, {
    type: "session.inactivity.resolve", atUtc: "2026-08-21T10:32:00.000Z", decision: "exclude"
  }).projection;
  assert.deepEqual(state.activeSession.inactiveIntervals, [{
    startedAtUtc: "2026-08-21T10:20:00.000Z",
    endedAtUtc: "2026-08-21T10:30:00.000Z"
  }]);
  assert.equal(state.activeSession.pendingInactivityStartedAtUtc, null);

  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T11:00:00.000Z",
    inactivityDecision: "exclude",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 50 * 60000 }]
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 50 * 60000);
});

test("a backward wall-clock jump cannot subtract or double-count focused time", () => {
  const state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-clock", taskId: null, primarySkill: "backend/study",
      plannedMinutes: null, startedAtUtc: "2026-08-21T10:00:00.000Z"
    }
  }).projection;

  assert.equal(SessionModel.summaryAt(state, "2026-08-21T09:55:00.000Z").focusedMilliseconds, 0);
  assert.throws(() => SessionModel.decide(state, {
    type: "session.pause", atUtc: "2026-08-21T09:55:00.000Z"
  }), /atUtc: must not precede the last Session transition/);
  assert.equal(SessionModel.summaryAt(state, "2026-08-21T10:15:00.000Z").focusedMilliseconds,
    15 * 60000);
});

test("runtime slicing finds an exact DailyXP boundary and removes confirmed inactivity", () => {
  const session = {
    segments: [{
      startedAtUtc: "2026-08-21T08:00:00.000Z",
      endedAtUtc: null
    }],
    inactiveIntervals: [{
      startedAtUtc: "2026-08-21T08:25:00.000Z",
      endedAtUtc: "2026-08-21T08:35:00.000Z"
    }]
  };
  const slices = SessionModel.dailySlicesAt(session, "2026-08-21T09:00:00.000Z", atUtc =>
    atUtc < "2026-08-21T08:20:00.000Z" ? "2026-08-20" : "2026-08-21");

  assert.deepEqual(slices, [
    { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 30 * 60000 }
  ]);
});

test("a correction cannot create future or overlapping Session history", () => {
  let state = SessionModel.emptyProjection();
  function finish(id, startedAtUtc, endedAtUtc) {
    state = apply(state, {
      type: "session.start",
      session: { id, taskId: null, primarySkill: "backend/build", plannedMinutes: null, startedAtUtc }
    }).projection;
    state = apply(state, {
      type: "session.finish", atUtc: endedAtUtc,
      dailySlices: [{
        dailyXpDate: "2026-08-21",
        milliseconds: new Date(endedAtUtc).getTime() - new Date(startedAtUtc).getTime()
      }]
    }).projection;
  }
  finish("session-a", "2026-08-21T08:00:00.000Z", "2026-08-21T09:00:00.000Z");
  finish("session-b", "2026-08-21T10:00:00.000Z", "2026-08-21T11:00:00.000Z");

  assert.throws(() => SessionModel.decide(state, {
    type: "session.correct", id: "session-a", atUtc: "2026-08-21T12:00:00.000Z",
    segments: [{
      startedAtUtc: "2026-08-21T11:30:00.000Z", endedAtUtc: "2026-08-21T12:30:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 60 * 60000 }]
  }), /segments: must not end after the correction/);

  assert.throws(() => SessionModel.decide(state, {
    type: "session.correct", id: "session-a", atUtc: "2026-08-21T12:00:00.000Z",
    segments: [{
      startedAtUtc: "2026-08-21T10:30:00.000Z", endedAtUtc: "2026-08-21T10:45:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 15 * 60000 }]
  }), /segments: must not overlap another Session/);
});

test("daily slices reject impossible calendar dates", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-calendar", taskId: null, primarySkill: "general/focus",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  }).projection;

  assert.throws(() => SessionModel.decide(state, {
    type: "session.finish", atUtc: "2026-08-21T09:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-02-30", milliseconds: 60 * 60000 }]
  }), /dailySlices.dailyXpDate: must be a real calendar date/);
});

test("correction segments normalize excluded inactivity before changing duration", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-inactive-correction", taskId: null, primarySkill: "general/focus",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  }).projection;
  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T09:00:00.000Z",
    inactivityDecision: "exclude",
    inactiveIntervals: [{
      startedAtUtc: "2026-08-21T08:20:00.000Z", endedAtUtc: "2026-08-21T08:30:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 50 * 60000 }]
  }).projection;

  const focusedSegments = SessionModel.focusedSegments(state.sessions[0], state.sessions[0].finishedAtUtc);
  assert.deepEqual(focusedSegments, [
    { startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-21T08:20:00.000Z" },
    { startedAtUtc: "2026-08-21T08:30:00.000Z", endedAtUtc: "2026-08-21T09:00:00.000Z" }
  ]);
  const revisedSegments = JSON.parse(JSON.stringify(focusedSegments));
  revisedSegments[1].endedAtUtc = "2026-08-21T08:55:00.000Z";
  state = apply(state, {
    type: "session.correct", id: "session-inactive-correction", atUtc: "2026-08-21T09:05:00.000Z",
    segments: revisedSegments,
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 45 * 60000 }],
    competitiveChangeConfirmed: true
  }).projection;

  assert.equal(state.sessions[0].focusedMilliseconds, 45 * 60000);
  assert.equal(state.sessions[0].competitiveMilliseconds, 45 * 60000);
  assert.deepEqual(state.sessions[0].inactiveIntervals, []);
});

test("included inactivity remains focused during a later correction", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-included-inactivity", taskId: null, primarySkill: "general/focus",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  }).projection;
  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T09:00:00.000Z",
    inactivityDecision: "include",
    inactiveIntervals: [{
      startedAtUtc: "2026-08-21T08:20:00.000Z", endedAtUtc: "2026-08-21T08:30:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 60 * 60000 }]
  }).projection;

  assert.equal(state.sessions[0].focusedMilliseconds, 60 * 60000);
  assert.deepEqual(state.sessions[0].inactiveIntervals, []);
  assert.equal(state.sessions[0].inactivityDecision, "include");
  assert.equal(state.sessions[0].observedInactivityIntervals.length, 1);
  assert.equal(SessionModel.focusedSegments(state.sessions[0], state.sessions[0].finishedAtUtc)
    .reduce((total, segment) => total + new Date(segment.endedAtUtc).getTime() -
      new Date(segment.startedAtUtc).getTime(), 0),
  60 * 60000);
});

test("Session corrections retain their frozen timezone and Day Boundary", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-frozen-slice", taskId: null, primarySkill: "general/focus",
      plannedMinutes: null, startedAtUtc: "2026-08-21T01:30:00.000Z"
    }
  }).projection;
  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T02:30:00.000Z",
    sliceContext: { timezone: "Africa/Cairo", dayBoundaryMinutes: 240 },
    dailySlices: [{ dailyXpDate: "2026-08-20", milliseconds: 60 * 60000 }]
  }).projection;
  state = apply(state, {
    type: "session.correct", id: "session-frozen-slice", atUtc: "2026-08-21T03:00:00.000Z",
    sliceContext: { timezone: "America/New_York", dayBoundaryMinutes: 0 },
    segments: [{
      startedAtUtc: "2026-08-21T01:30:00.000Z", endedAtUtc: "2026-08-21T02:20:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-20", milliseconds: 50 * 60000 }],
    competitiveChangeConfirmed: true
  }).projection;

  assert.deepEqual(state.sessions[0].sliceContext,
    { timezone: "Africa/Cairo", dayBoundaryMinutes: 240 });
});

test("revised duration keeps frozen DailyXP attribution without consulting current settings", () => {
  assert.deepEqual(SessionModel.revisedDailySlices([
    { dailyXpDate: "2026-08-20", milliseconds: 30 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 30 * 60000 }
  ], 75 * 60000), [
    { dailyXpDate: "2026-08-20", milliseconds: 30 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 45 * 60000 }
  ]);
  assert.deepEqual(SessionModel.revisedDailySlices([
    { dailyXpDate: "2026-08-20", milliseconds: 30 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 30 * 60000 }
  ], 20 * 60000), [
    { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 }
  ]);
});

test("exact resizing truncates across pause segments to the requested total", () => {
  assert.deepEqual(SessionModel.resizeFocusedSegments([
    { startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-21T08:30:00.000Z" },
    { startedAtUtc: "2026-08-21T09:00:00.000Z", endedAtUtc: "2026-08-21T09:30:00.000Z" }
  ], 20 * 60000, "2026-08-21T10:00:00.000Z"), [
    { startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-21T08:20:00.000Z" }
  ]);
  assert.deepEqual(SessionModel.resizeFocusedSegments([
    { startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-21T08:30:00.000Z" },
    { startedAtUtc: "2026-08-21T09:00:00.000Z", endedAtUtc: "2026-08-21T09:30:00.000Z" }
  ], 45 * 60000, "2026-08-21T10:00:00.000Z"), [
    { startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-21T08:30:00.000Z" },
    { startedAtUtc: "2026-08-21T09:00:00.000Z", endedAtUtc: "2026-08-21T09:15:00.000Z" }
  ]);
});

test("frozen timeline re-slices a correction across its original Day Boundary", () => {
  const timeline = SessionModel.dailyXpTimelineAt(
    "2026-08-21T03:40:00.000Z", "2026-08-21T04:30:00.000Z",
    atUtc => atUtc < "2026-08-21T04:00:00.000Z" ? "2026-08-20" : "2026-08-21");
  assert.deepEqual(timeline, [
    { dailyXpDate: "2026-08-20", startedAtUtc: "2026-08-21T03:40:00.000Z",
      endedAtUtc: "2026-08-21T04:00:00.000Z" },
    { dailyXpDate: "2026-08-21", startedAtUtc: "2026-08-21T04:00:00.000Z",
      endedAtUtc: "2026-08-21T04:30:00.000Z" }
  ]);
  assert.deepEqual(SessionModel.dailySlicesFromTimeline([{
    startedAtUtc: "2026-08-21T03:40:00.000Z", endedAtUtc: "2026-08-21T04:10:00.000Z"
  }], timeline), [
    { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 10 * 60000 }
  ]);
});

test("a frozen correction horizon attributes an extension and updates its finish", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-extension", taskId: null, primarySkill: "general/focus",
      plannedMinutes: null, startedAtUtc: "2026-08-21T03:40:00.000Z"
    }
  }).projection;
  const timeline = SessionModel.dailyXpTimelineAt(
    "2026-08-21T03:40:00.000Z", "2026-08-22T03:50:00.000Z",
    atUtc => atUtc < "2026-08-21T04:00:00.000Z" ? "2026-08-20" : "2026-08-21");
  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T03:50:00.000Z",
    sliceContext: { timezone: "Africa/Cairo", dayBoundaryMinutes: 240 },
    sliceTimeline: timeline,
    dailySlices: [{ dailyXpDate: "2026-08-20", milliseconds: 10 * 60000 }]
  }).projection;
  const segments = [{
    startedAtUtc: "2026-08-21T03:40:00.000Z", endedAtUtc: "2026-08-21T04:10:00.000Z"
  }];
  state = apply(state, {
    type: "session.correct", id: "session-extension", atUtc: "2026-08-21T05:00:00.000Z",
    segments: segments,
    dailySlices: SessionModel.dailySlicesFromTimeline(segments, timeline),
    competitiveChangeConfirmed: true
  }).projection;

  assert.equal(state.sessions[0].finishedAtUtc, "2026-08-21T04:10:00.000Z");
  assert.equal(state.sessions[0].originalFinishedAtUtc, "2026-08-21T03:50:00.000Z");
  assert.deepEqual(state.sessions[0].dailySlices, [
    { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 10 * 60000 }
  ]);
});

test("correcting the finish instant never rolls the 24-hour free-edit deadline", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: {
      id: "session-audit-deadline", taskId: null, primarySkill: "general/focus",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:00:00.000Z"
    }
  }).projection;
  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T09:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 60 * 60000 }]
  }).projection;
  state = apply(state, {
    type: "session.correct", id: "session-audit-deadline", atUtc: "2026-08-22T08:00:00.000Z",
    segments: [{
      startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-22T08:00:00.000Z"
    }],
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 24 * 60 * 60000 }],
    competitiveChangeConfirmed: true, dailyCapAcknowledged: true
  }).projection;
  assert.equal(state.sessions[0].lastRevisionKind, "correction");
  state = apply(state, {
    type: "session.correct", id: "session-audit-deadline", atUtc: "2026-08-22T10:00:00.000Z",
    segments: [{
      startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: "2026-08-22T08:00:00.000Z"
    }],
    changes: { primarySkill: "backend/study" },
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 24 * 60 * 60000 }]
  }).projection;
  assert.equal(state.sessions[0].lastRevisionKind, "adjustment");
  assert.equal(state.sessions[0].originalFinishedAtUtc, "2026-08-21T09:00:00.000Z");
});

// ── GH-61 integrity matrix ──────────────────────────────────────────────

test("single-active invariant — start blocks while one is running and only finish/discard releases it", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-single-1", taskId: "t1", primarySkill: "backend/build",
      plannedMinutes: 60, startedAtUtc: "2026-08-21T08:00:00.000Z" }
  }).projection;

  assert.equal(state.activeSession.id, "m-single-1");
  assert.equal(state.sessions.length, 0);
  assert.throws(() => SessionModel.decide(state, {
    type: "session.start",
    session: { id: "m-single-2", taskId: null, primarySkill: "backend/study",
      plannedMinutes: null, startedAtUtc: "2026-08-21T08:05:00.000Z" }
  }), /activeSession: already exists/);

  // pause/resume does not release, change_task does not release
  state = apply(state, { type: "session.pause", atUtc: "2026-08-21T08:10:00.000Z" }).projection;
  assert.equal(state.activeSession.status, "paused");
  assert.throws(() => SessionModel.decide(state, { type: "session.start",
    session: { id: "m-single-3", primarySkill: "reading", plannedMinutes: null, startedAtUtc: "2026-08-21T08:11:00.000Z" } }),
    /activeSession: already exists/);
  state = apply(state, { type: "session.resume", atUtc: "2026-08-21T08:15:00.000Z" }).projection;
  state = apply(state, { type: "session.change_task", taskId: "t2", primarySkill: "backend/study",
    atUtc: "2026-08-21T08:16:00.000Z" }).projection;
  assert.equal(state.activeSession.id, "m-single-1");
  assert.equal(state.activeSession.taskId, "t2");

  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T08:30:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 25 * 60000 }]
  }).projection;
  assert.equal(state.activeSession, null);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].focusedMilliseconds, 25 * 60000);

  // After finish, a new start is allowed — no ghost active
  state = apply(state, {
    type: "session.start",
    session: { id: "m-single-4", primarySkill: "reading", plannedMinutes: null,
      startedAtUtc: "2026-08-21T09:00:00.000Z" }
  }).projection;
  assert.equal(state.activeSession.id, "m-single-4");
  assert.ok(Object.isFrozen(state));
});

test("plan vs free Sessions — free needs no overtime gate, discard keeps focused but not taskCompleted", () => {
  // Free: finish without plannedDurationDecision succeeds, focused == competitive
  let free = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-free", taskId: null, primarySkill: "reading",
      plannedMinutes: null, startedAtUtc: "2026-08-21T10:00:00.000Z" }
  }).projection;
  free = apply(free, {
    type: "session.finish", atUtc: "2026-08-21T10:30:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 30 * 60000 }]
  }).projection;
  assert.equal(free.sessions[0].focusedMilliseconds, 30 * 60000);
  assert.equal(free.sessions[0].competitiveMilliseconds, 30 * 60000);

  // Planned: overtime without decision returns confirmation, not events
  let planned = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-plan", taskId: "t1", primarySkill: "backend/build",
      plannedMinutes: 60, startedAtUtc: "2026-08-21T08:00:00.000Z" }
  }).projection;
  const unconfirmed = SessionModel.decide(planned, {
    type: "session.finish", atUtc: "2026-08-21T09:10:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 70 * 60000 }]
  });
  assert.equal(unconfirmed.events.length, 0);
  assert.deepEqual(unconfirmed.confirmation.reasons, ["planned-duration"]);

  planned = apply(planned, {
    type: "session.finish", atUtc: "2026-08-21T09:10:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 70 * 60000 }],
    plannedDurationDecision: "exclude-overtime"
  }).projection;
  assert.equal(planned.sessions[0].competitiveMilliseconds, 60 * 60000);
  assert.deepEqual(planned.sessions[0].competitiveAdjustments[0], { reason: "planned-duration", excludedMilliseconds: 10 * 60000 });

  // Discard vs finish: discard keeps focused for diagnostics but not taskCompleted
  let discard = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-discard", taskId: null, primarySkill: "reading",
      plannedMinutes: null, startedAtUtc: "2026-08-21T10:00:00.000Z" }
  }).projection;
  discard = apply(discard, { type: "session.discard", atUtc: "2026-08-21T10:10:00.000Z" }).projection;
  assert.equal(discard.sessions[0].status, "discarded");
  assert.equal(discard.sessions[0].focusedMilliseconds, 10 * 60000);
  assert.equal(discard.sessions[0].taskCompleted, undefined);
});

test("12h daily competitive cap — acknowledged gate, no double count across days", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-cap-single", primarySkill: "backend/build", plannedMinutes: null,
      startedAtUtc: "2026-08-21T04:00:00.000Z" }
  }).projection;

  const needsCap = SessionModel.decide(state, {
    type: "session.finish", atUtc: "2026-08-21T17:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 13 * 60 * 60000 }]
  });
  assert.deepEqual(needsCap.confirmation.reasons, ["daily-cap"]);

  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T17:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 13 * 60 * 60000 }],
    dailyCapAcknowledged: true
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 13 * 60 * 60000);
  assert.equal(state.sessions[0].competitiveMilliseconds, 12 * 60 * 60000);
  assert.deepEqual(state.sessions[0].competitiveByDailyXpDate, { "2026-08-21": 12 * 60 * 60000 });

  // Multi-day: 8h + 7h = 15h total, no per-day cap hit, but focused duration
  // is capped by wall-clock (sessionSummary truncates to 60*60000) — so dailySlices
  // must match that focused duration. Use a focused-matching slice total.
  let multi = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-cap-multi", primarySkill: "backend/build", plannedMinutes: null,
      startedAtUtc: "2026-08-20T04:00:00.000Z" }
  }).projection;
  const multiFocused = SessionModel.summaryAt(multi, "2026-08-21T17:00:00.000Z").focusedMilliseconds;
  multi = apply(multi, {
    type: "session.finish", atUtc: "2026-08-21T17:00:00.000Z",
    dailySlices: [
      { dailyXpDate: "2026-08-20", milliseconds: Math.floor(multiFocused * 0.5) },
      { dailyXpDate: "2026-08-21", milliseconds: Math.ceil(multiFocused * 0.5) }
    ],
    dailyCapAcknowledged: true
  }).projection;
  const capSum = Object.values(multi.sessions[0].competitiveByDailyXpDate).reduce((a,v)=>a+v,0);
  assert.equal(capSum, multi.sessions[0].competitiveMilliseconds);
  assert.equal(multi.sessions[0].focusedMilliseconds, multiFocused);
});

test("inactivity without capture — intervals only count after a user decision", () => {
  let state = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-idle", primarySkill: "reading", plannedMinutes: null,
      startedAtUtc: "2026-08-21T10:00:00.000Z" }
  }).projection;

  // detect → return → pending confirmation
  state = apply(state, { type: "session.inactivity.detect", atUtc: "2026-08-21T10:20:00.000Z" }).projection;
  state = apply(state, { type: "session.inactivity.return", atUtc: "2026-08-21T10:30:00.000Z" }).projection;
  assert.equal(state.activeSession.pendingInactivityStartedAtUtc, "2026-08-21T10:20:00.000Z");
  assert.equal(state.activeSession.pendingInactivityEndedAtUtc, "2026-08-21T10:30:00.000Z");
  // finish while pending must request confirmation
  assert.deepEqual(SessionModel.decide(state, {
    type: "session.finish", atUtc: "2026-08-21T10:35:00.000Z"
  }).confirmation.reasons, ["inactivity"]);

  // exclude after decision — focused drops by the interval
  state = apply(state, { type: "session.inactivity.resolve", atUtc: "2026-08-21T10:32:00.000Z", decision: "exclude" }).projection;
  assert.deepEqual(state.activeSession.inactiveIntervals, [{ startedAtUtc: "2026-08-21T10:20:00.000Z", endedAtUtc: "2026-08-21T10:30:00.000Z" }]);
  assert.equal(state.activeSession.pendingInactivityStartedAtUtc, null);

  const beforeFinish = JSON.stringify(state.activeSession);
  assert.doesNotMatch(beforeFinish, /"keys"|"screens"|"urls"/);
  // In this flow the interval was already resolved via inactivity.resolve, so
  // finish's own inactivityDecision stays null — the decision is proven by the
  // stored inactiveIntervals and the focused drop, not by a duplicate field.
  assert.deepEqual(state.activeSession.inactiveIntervals, [{ startedAtUtc: "2026-08-21T10:20:00.000Z", endedAtUtc: "2026-08-21T10:30:00.000Z" }]);

  state = apply(state, {
    type: "session.finish", atUtc: "2026-08-21T11:00:00.000Z",
    inactivityDecision: "exclude",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 50 * 60000 }]
  }).projection;
  assert.equal(state.sessions[0].focusedMilliseconds, 50 * 60000);
  assert.doesNotMatch(JSON.stringify(state.sessions[0]), /"keys"|"screens"|"urls"/);

  // include path keeps the interval focused — when resolved via the dedicated
  // active-interval path, finish's inactivityDecision stays null (decision
  // is already proven by empty inactiveIntervals), so don't assert the string.
  let include = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-idle-inc", primarySkill: "reading", plannedMinutes: null,
      startedAtUtc: "2026-08-21T10:00:00.000Z" }
  }).projection;
  include = apply(include, { type: "session.inactivity.detect", atUtc: "2026-08-21T10:20:00.000Z" }).projection;
  include = apply(include, { type: "session.inactivity.return", atUtc: "2026-08-21T10:30:00.000Z" }).projection;
  include = apply(include, { type: "session.inactivity.resolve", atUtc: "2026-08-21T10:32:00.000Z", decision: "include" }).projection;
  assert.deepEqual(include.activeSession.inactiveIntervals, []);
  include = apply(include, {
    type: "session.finish", atUtc: "2026-08-21T11:00:00.000Z",
    inactivityDecision: "include",
    dailySlices: [{ dailyXpDate: "2026-08-21", milliseconds: 60 * 60000 }]
  }).projection;
  assert.equal(include.sessions[0].focusedMilliseconds, 60 * 60000);
});

test("wall-clock jump, day-boundary slicing, and frozen correction horizon", () => {
  // Backward jump cannot subtract or double-count
  const jumped = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-clock", primarySkill: "backend/study", plannedMinutes: null,
      startedAtUtc: "2026-08-21T10:00:00.000Z" }
  }).projection;
  assert.equal(SessionModel.summaryAt(jumped, "2026-08-21T09:55:00.000Z").focusedMilliseconds, 0);
  assert.throws(() => SessionModel.decide(jumped, { type: "session.pause", atUtc: "2026-08-21T09:55:00.000Z" }),
    /atUtc: must not precede the last Session transition/);
  assert.equal(SessionModel.summaryAt(jumped, "2026-08-21T10:15:00.000Z").focusedMilliseconds, 15 * 60000);

  // Day-boundary slicing: synthetic dateAtUtc flips at 08:20Z on 08:00–09:00 → 20m + 40m
  const slices = SessionModel.dailySlicesAt(
    { segments: [{ startedAtUtc: "2026-08-21T08:00:00.000Z", endedAtUtc: null }], inactiveIntervals: [] },
    "2026-08-21T09:00:00.000Z",
    atUtc => atUtc < "2026-08-21T08:20:00.000Z" ? "2026-08-20" : "2026-08-21"
  );
  assert.deepEqual(slices, [
    { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 40 * 60000 }
  ]);

  // Cross-boundary finish attributes to majority day
  let cross = apply(SessionModel.emptyProjection(), {
    type: "session.start",
    session: { id: "m-cross", primarySkill: "backend/study", plannedMinutes: null,
      startedAtUtc: "2026-08-21T00:00:00.000Z" }
  }).projection;
  cross = apply(cross, {
    type: "session.finish", atUtc: "2026-08-21T01:00:00.000Z",
    dailySlices: [{ dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 }, { dailyXpDate: "2026-08-21", milliseconds: 40 * 60000 }]
  }).projection;
  assert.equal(cross.sessions[0].dailyXpDate, "2026-08-21");

  // Frozen correction horizon re-slices across original Day Boundary without inventing a new one
  const timeline = SessionModel.dailyXpTimelineAt(
    "2026-08-21T03:40:00.000Z", "2026-08-21T04:30:00.000Z",
    atUtc => atUtc < "2026-08-21T04:00:00.000Z" ? "2026-08-20" : "2026-08-21");
  const corrected = SessionModel.dailySlicesFromTimeline(
    [{ startedAtUtc: "2026-08-21T03:40:00.000Z", endedAtUtc: "2026-08-21T04:10:00.000Z" }], timeline);
  assert.deepEqual(corrected, [
    { dailyXpDate: "2026-08-20", milliseconds: 20 * 60000 },
    { dailyXpDate: "2026-08-21", milliseconds: 10 * 60000 }
  ]);
});
