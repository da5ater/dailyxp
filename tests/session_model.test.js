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
    type: "session.change_task", taskId: "task-dailyxp", atUtc: "2026-08-21T10:05:00.000Z"
  }).projection;
  assert.equal(state.activeSession.taskId, "task-dailyxp");

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
