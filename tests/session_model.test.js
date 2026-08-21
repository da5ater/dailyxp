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
});
