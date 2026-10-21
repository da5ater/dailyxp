const { test } = require("node:test");
const assert = require("node:assert/strict");

test("editing a Session Skill preserves its exact unedited focused time", async () => {
  const { editorCommand } = await import("../renderer/editor.js");
  const item = {
    id: "finished-session",
    focusedMilliseconds: 1237,
    segments: [
      {
        startedAtUtc: "2026-10-21T09:00:00.000Z",
        endedAtUtc: "2026-10-21T09:00:01.237Z",
      },
    ],
  };
  const form = new FormData();
  form.set(
    "focusedMinutes",
    Number((item.focusedMilliseconds / 60000).toFixed(4)),
  );
  form.set("skill", "systems/review");
  const result = editorCommand({ kind: "session", item }, form, {
    planning: { milestones: [] },
  });
  assert.equal(result.value.focusedMilliseconds, item.focusedMilliseconds);
  assert.equal(result.value.changes.primarySkill, "systems/review");
});

test("editing linked work keeps its completed Milestone selectable and selected", async () => {
  const { editorFields, editorCommand } = await import("../renderer/editor.js");
  const milestone = {
    id: "finished",
    title: "Finished checkpoint",
    status: "completed",
    goalId: "goal",
  };
  const item = {
    id: "task",
    title: "Still useful",
    milestoneId: milestone.id,
    goalId: "goal",
    primarySkill: "systems/review",
    estimateMinutes: 25,
  };
  const state = {
    planning: {
      goals: [{ id: "goal", title: "Outcome" }],
      milestones: [milestone],
    },
  };
  const html = editorFields("task", item, null, state);
  assert.match(html, /option value="finished" selected/);
  const form = new FormData();
  for (const [key, value] of Object.entries({
    title: item.title,
    milestoneId: "finished",
    minutes: "25",
    skill: item.primarySkill,
  }))
    form.set(key, value);
  assert.equal(
    editorCommand({ kind: "task", item }, form, state).value.changes
      .milestoneId,
    "finished",
  );
});
