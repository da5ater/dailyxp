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
  assert.deepEqual(result.value.segments, item.segments);
  assert.equal(result.value.changes.primarySkill, "systems/review");
});
