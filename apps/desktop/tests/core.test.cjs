const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Core } = require("../core/core.cjs");
const { serve, request } = require("../core/integration.cjs");
function fixture(t, options) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-core-"));
  const core = new Core(directory, options);
  t.after(() => {
    if (core.ownsLock) core.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return core;
}
function task(id = "task-1") {
  return {
    type: "task.create",
    task: {
      id,
      title: "Build parser",
      estimateMinutes: 25,
      urgency: "normal",
      primarySkill: "backend/build",
      deadline: null,
      goalId: null,
      milestoneId: null,
    },
  };
}
test("a task, Session and awarded XP survive real disk replay", (t) => {
  let now = new Date("2026-10-21T09:00:00.000Z");
  const c = fixture(t, { clock: () => now });
  c.execute("planning", task());
  c.execute("session", {
    type: "session.start",
    session: {
      taskId: "task-1",
      primarySkill: "backend/build",
      plannedMinutes: 25,
    },
  });
  now = new Date("2026-10-21T09:20:00.000Z");
  c.execute("session", { type: "session.pause" });
  assert.equal(c.status().session.focusedMilliseconds, 1200000);
  c.execute("session", { type: "session.finish" });
  assert.ok(c.status().lifetimeXp > 0);
  const status = c.status();
  c.close();
  const replay = new Core(c.directory, { clock: () => now });
  try {
    assert.equal(replay.status().lifetimeXp, status.lifetimeXp);
    assert.equal(replay.snapshot().planning.tasks[0].title, "Build parser");
  } finally {
    replay.close();
  }
});
test("retries are idempotent across restart and reject request ID reuse", (t) => {
  const c = fixture(t);
  c.execute("planning", task(), "retry");
  c.close();
  const replay = new Core(c.directory);
  try {
    replay.execute("planning", task(), "retry");
    assert.equal(replay.snapshot().planning.tasks.length, 1);
    assert.throws(
      () => replay.execute("planning", task("other"), "retry"),
      /already used/,
    );
  } finally {
    replay.close();
  }
});
test("a failed save leaves the projection and original file unchanged", (t) => {
  const c = fixture(t);
  const before = fs.readFileSync(
    path.join(c.directory, "desktop.json"),
    "utf8",
  );
  c.write = () => {
    throw new Error("Disk full");
  };
  assert.throws(() => c.execute("planning", task()), /Disk full/);
  assert.equal(c.snapshot().planning.tasks.length, 0);
  assert.equal(
    fs.readFileSync(path.join(c.directory, "desktop.json"), "utf8"),
    before,
  );
});
test("only one writer can open a profile and corrupt import writes nothing", (t) => {
  const c = fixture(t);
  assert.throws(() => new Core(c.directory), /already has a writer/);
  const before = c.exportState();
  assert.throws(() => c.importLegacy("{bad"), /checksum/);
  assert.equal(c.exportState(), before);
});
test("legacy import preserves its source and earned progress", (t) => {
  let now = new Date("2026-10-21T09:00:00.000Z");
  const source = fixture(t, { clock: () => now });
  source.execute("planning", task());
  source.execute("session", {
    type: "session.start",
    session: {
      taskId: "task-1",
      primarySkill: "backend/build",
      plannedMinutes: 25,
    },
  });
  now = new Date("2026-10-21T09:20:00.000Z");
  source.execute("session", { type: "session.finish" });
  assert.ok(source.status().lifetimeXp > 0);
  const raw = source.exportState();
  const target = fixture(t);
  target.importLegacy(raw);
  assert.equal(target.snapshot().planning.tasks[0].id, "task-1");
  assert.equal(target.status().lifetimeXp, source.status().lifetimeXp);
  assert.deepEqual(
    target.snapshot().progression.ledger,
    source.snapshot().progression.ledger,
  );
  assert.equal(source.exportState(), raw);
});
test("companion status hides titles and Recovery and drives the real Session", async (t) => {
  const c = fixture(t);
  c.execute("planning", task());
  c.execute("session", {
    type: "session.start",
    session: { taskId: "task-1", primarySkill: "backend/build" },
  });
  let opened = 0;
  const server = await serve(c, () => opened++);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const status = await request(c.directory, "status");
  assert.equal(status.session.status, "running");
  assert.ok(!JSON.stringify(status).includes("Build parser"));
  assert.ok(!JSON.stringify(status).includes("recovery"));
  await request(c.directory, "pause", "pause-one");
  await request(c.directory, "pause", "pause-one");
  assert.equal(c.status().session.status, "paused");
  await request(c.directory, "resume");
  assert.equal(c.status().session.status, "running");
  await request(c.directory, "open");
  assert.equal(opened, 1);
  await assert.rejects(request(c.directory, "export"), /Unsupported/);
});
test("corrupt primary recovers only from a validated backup", (t) => {
  const c = fixture(t);
  c.execute("planning", task());
  c.settings({ dailyTargetMinutes: 90 });
  c.close();
  fs.writeFileSync(path.join(c.directory, "desktop.json"), "{broken");
  const replay = new Core(c.directory);
  try {
    assert.equal(replay.snapshot().planning.tasks.length, 1);
    replay.execute("planning", task("two"));
  } finally {
    replay.close();
  }
  const final = new Core(c.directory);
  try {
    assert.equal(final.snapshot().planning.tasks.length, 2);
  } finally {
    final.close();
  }
});
test("a Habit completion cannot multiply XP through rapid requests", (t) => {
  const c = fixture(t);
  c.execute("habit", {
    type: "habit.create",
    habit: {
      id: "stretch",
      title: "Stretch",
      startDate: c.dateAt(),
      schedule: { type: "daily" },
      restDates: [],
    },
  });
  c.execute("habit", {
    type: "habit.complete",
    habitId: "stretch",
    dailyXpDate: c.dateAt(),
  });
  const xp = c.status().lifetimeXp;
  for (let i = 0; i < 10; i++)
    c.execute("habit", {
      type: "habit.complete",
      habitId: "stretch",
      dailyXpDate: c.dateAt(),
    });
  assert.equal(c.status().lifetimeXp, xp);
});
test("a missing primary uses the last valid backup rather than creating fresh state", (t) => {
  const c = fixture(t);
  c.execute("planning", task());
  c.settings({ dailyTargetMinutes: 80 });
  c.close();
  fs.unlinkSync(path.join(c.directory, "desktop.json"));
  const replay = new Core(c.directory);
  try {
    assert.equal(replay.snapshot().planning.tasks[0].id, "task-1");
  } finally {
    replay.close();
  }
});
test("inactivity is an explicit scoring decision and keeps persisted progress", (t) => {
  let now = new Date("2026-10-21T09:00:00.000Z");
  const c = fixture(t, { clock: () => now });
  c.execute("session", {
    type: "session.start",
    session: { taskId: null, primarySkill: "general/focus" },
  });
  now = new Date("2026-10-21T09:05:00.000Z");
  c.observeDesktop(300);
  now = new Date("2026-10-21T09:10:00.000Z");
  c.observeDesktop(0);
  assert.ok(c.snapshot().session.activeSession.pendingInactivityEndedAtUtc);
  c.execute("session", {
    type: "session.inactivity.resolve",
    decision: "exclude",
  });
  now = new Date("2026-10-21T09:15:00.000Z");
  c.execute("session", { type: "session.finish" });
  assert.equal(c.snapshot().session.sessions[0].focusedMilliseconds, 300000);
});
test("a no-op retry stays a no-op after intervening Habit changes and restart", (t) => {
  const c = fixture(t);
  const date = c.dateAt();
  c.execute("habit", {
    type: "habit.create",
    habit: {
      id: "stretch",
      title: "Stretch",
      startDate: date,
      schedule: { type: "daily" },
      restDates: [],
    },
  });
  const complete = {
    type: "habit.complete",
    habitId: "stretch",
    dailyXpDate: date,
  };
  c.execute("habit", complete, "first");
  assert.equal(c.execute("habit", complete, "noop").changed, false);
  c.execute("habit", {
    type: "habit.uncomplete",
    habitId: "stretch",
    dailyXpDate: date,
  });
  c.close();
  const replay = new Core(c.directory);
  try {
    assert.equal(replay.execute("habit", complete, "noop").changed, false);
    assert.equal(replay.snapshot().habit.completions.length, 0);
  } finally {
    replay.close();
  }
});
test("an empty profile advances both calendars and materializes a new Routine today", (t) => {
  const c = fixture(t);
  const today = c.dateAt();
  assert.equal(c.snapshot().planning.lastAdvancedDailyXpDate, today);
  assert.equal(c.snapshot().habit.lastAdvancedDailyXpDate, today);
  c.execute("planning", {
    type: "routine.create",
    routine: {
      id: "routine",
      title: "Daily practice",
      primarySkill: "general/focus",
      expectedMinutes: 25,
      carryover: false,
      startDate: today,
      endDate: null,
      restDates: [],
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7] },
      goalId: null,
      milestoneId: null,
    },
  });
  assert.equal(c.snapshot().planning.occurrences[0].dailyXpDate, today);
});
test("companion-independent eligibility excludes a future Habit", (t) => {
  const c = fixture(t);
  c.execute("habit", {
    type: "habit.create",
    habit: {
      id: "future",
      title: "Future habit",
      schedule: { type: "daily" },
      startDate: "2099-01-01",
      restDates: [],
    },
  });
  assert.ok(!c.snapshot().eligibleHabitIds.includes("future"));
});

test("Skill-only Session correction preserves excluded idle time through editor and disk replay", async (t) => {
  const { editorCommand } = await import("../renderer/editor.js");
  let now = new Date("2026-10-21T09:00:00.000Z");
  const c = fixture(t, { clock: () => now });
  c.execute("session", {
    type: "session.start",
    session: { primarySkill: "general/focus" },
  });
  now = new Date("2026-10-21T09:05:00.000Z");
  c.observeDesktop(300);
  now = new Date("2026-10-21T09:10:00.000Z");
  c.observeDesktop(0);
  c.execute("session", {
    type: "session.inactivity.resolve",
    decision: "exclude",
  });
  now = new Date("2026-10-21T09:15:00.000Z");
  c.execute("session", { type: "session.finish" });
  const before = c.snapshot();
  const item = before.session.sessions[0];
  const form = new FormData();
  form.set(
    "focusedMinutes",
    Number((item.focusedMilliseconds / 60000).toFixed(4)),
  );
  form.set("skill", "systems/review");
  const command = editorCommand({ kind: "session", item }, form, before);
  const result = c.execute(command.domain, command.value);
  assert.equal(result.confirmation, null);
  assert.equal(c.snapshot().session.sessions[0].focusedMilliseconds, 300000);
  assert.equal(c.status().lifetimeXp, before.progression.totals.lifetimeXp);
  c.close();
  const replay = new Core(c.directory, { clock: () => now });
  try {
    assert.equal(
      replay.snapshot().session.sessions[0].focusedMilliseconds,
      300000,
    );
    assert.equal(
      replay.snapshot().session.sessions[0].primarySkill,
      "systems/review",
    );
  } finally {
    replay.close();
  }
});

test("Recovery is private in canonical storage, ordinary projections and replay", (t) => {
  const c = fixture(t, { clock: () => new Date("2026-10-21T09:00:00Z") });
  const ordinaryBefore = c.status().lifetimeXp;
  assert.throws(
    () =>
      c.execute("recovery", {
        type: "recovery.track.create",
        dailyXpDate: "2099-01-01",
        track: {
          id: "future",
          category: "custom",
          customCategory: "Future",
          startDate: "2026-10-22",
        },
      }),
    /future/,
  );
  c.execute("recovery", {
    type: "recovery.track.create",
    track: {
      id: "private",
      category: "custom",
      customCategory: "Secret track",
      startDate: "2026-10-18",
      visibility: "public",
    },
  });
  assert.equal(c.snapshot().recoveryTrackStates.private.days, 4);
  c.execute("recovery", {
    type: "recovery.checkin",
    trackId: "private",
    note: "Secret note",
  });
  c.execute("recovery", {
    type: "recovery.checkin",
    trackId: "private",
    note: "Duplicate",
  });
  c.execute("recovery", { type: "recovery.relapse", trackId: "private" });
  c.execute("recovery", { type: "recovery.restart", trackId: "private" });
  c.execute("recovery", { type: "recovery.relapse", trackId: "private" });
  c.execute("recovery", { type: "recovery.restart", trackId: "private" });
  const snapshot = c.snapshot();
  assert.equal(new Set(snapshot.recovery.attempts.map((a) => a.id)).size, 3);
  assert.equal(snapshot.recovery.checkIns.length, 1);
  assert.equal(snapshot.recoveryTrackStates.private.checkedIn, true);
  assert.equal(c.status().lifetimeXp, ordinaryBefore);
  assert.ok(
    c.journal.events
      .filter((e) => e.type.startsWith("recovery."))
      .every((e) => e.private === true),
  );
  for (const ordinary of [
    c.status(),
    snapshot.progression,
    snapshot.insight,
    snapshot.share,
    snapshot.story,
  ]) {
    assert.doesNotMatch(
      JSON.stringify(ordinary),
      /Secret track|Secret note|Duplicate/,
    );
  }
  c.close();
  const replay = new Core(c.directory, {
    clock: () => new Date("2026-10-21T09:00:00Z"),
  });
  try {
    assert.deepEqual(replay.snapshot().recovery, snapshot.recovery);
    assert.equal(replay.status().lifetimeXp, ordinaryBefore);
  } finally {
    replay.close();
  }
});

test("World follows real Goal and Milestone events across disk replay", (t) => {
  const c = fixture(t);
  c.execute("planning", {
    type: "goal.create",
    goal: {
      id: "province",
      title: "Build the kingdom",
      reason: "Learn",
      primarySkill: "general/focus",
    },
  });
  for (const id of ["one", "two"])
    c.execute("planning", {
      type: "milestone.create",
      milestone: {
        id,
        title: id,
        goalId: "province",
        measurement: { type: "binary" },
        significance: 1,
      },
    });
  c.execute("planning", { type: "milestone.progress", id: "one", value: true });
  const story = c.snapshot().story;
  assert.equal(story.provinces[0].fraction, 0.5);
  assert.match(story.momentumCause, /day|activity/i);
  c.close();
  const replay = new Core(c.directory);
  try {
    assert.deepEqual(replay.snapshot().story, story);
  } finally {
    replay.close();
  }
});

test("a real Milestone after inactivity clears Hollow King and replays its activity date", (t) => {
  const { prepareWorld } = require("../scripts/world-fixture.cjs");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-world-"));
  const now = new Date("2026-10-21T12:00:00Z");
  prepareWorld(directory, now);
  const c = new Core(directory, { clock: () => now });
  t.after(() => {
    if (c.ownsLock) c.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  assert.ok(c.snapshot().story.antagonists.some((a) => a.id === "hollow-king"));
  c.execute("planning", {
    type: "milestone.progress",
    id: "planned",
    value: true,
  });
  const snapshot = c.snapshot();
  assert.ok(!snapshot.story.antagonists.some((a) => a.id === "hollow-king"));
  assert.equal(snapshot.story.provinces[0].fraction, 1);
  assert.match(snapshot.story.momentumCause, /1 day with earned activity/);
  const award = snapshot.progression.ledger.find(
    (entry) => entry.reason === "milestone completed: planned",
  );
  assert.equal(award.dailyXpDate, c.dateAt());
  c.close();
  const replay = new Core(directory, { clock: () => now });
  try {
    assert.deepEqual(replay.snapshot().story, snapshot.story);
  } finally {
    replay.close();
  }
});
