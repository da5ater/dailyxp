const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Core, atomicWrite } = require("../core/core.cjs");
const Blocks = require("../../../DayBlockModel.js");
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "day-blocks-"));
  let at = new Date("2026-10-22T20:00:00.000Z");
  const options = { clock: () => at };
  let core = new Core(dir, options);
  t.after(() => {
    core.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return {
    get core() {
      return core;
    },
    set(ms) {
      at = new Date(ms);
    },
    add(ms) {
      at = new Date(at.getTime() + ms);
    },
    reopen() {
      core.close();
      core = new Core(dir, options);
      return core;
    },
  };
}
const plan = [
  {
    id: "a",
    title: "Learn",
    durationMinutes: 2,
    tasks: [
      { id: "read", title: "Read", targetMinutes: 1 },
      { id: "write", title: "Write", targetMinutes: 1 },
    ],
  },
  {
    id: "b",
    title: "Move",
    durationMinutes: 1,
    tasks: [{ id: "walk", title: "Walk", targetMinutes: 1 }],
  },
];
function save(f, blocks = plan) {
  f.core.execute("dayblock", {
    type: "plan.save",
    expectedRevision: f.core.snapshot().dayBlocks.plan.revision,
    expectedPlanId: f.core.snapshot().dayBlocks.plan.id,
    blocks,
  });
}
function start(f, id = "a") {
  f.core.execute("dayblock", {
    type: "block.start",
    expectedPlanId: f.core.snapshot().dayBlocks.plan.id,
    expectedRevision: f.core.snapshot().dayBlocks.plan.revision,
    blockId: id,
  });
}
function next(f) {
  f.core.execute("dayblock", {
    type: "block.next",
    expectedRunId: f.core.snapshot().dayBlocks.current.id,
  });
}
test("task target prompts without moving; block deadline wins and next receives full time", (t) => {
  const f = fixture(t);
  save(f);
  start(f);
  const id = f.core.snapshot().dayBlocks.current.id;
  f.add(59999);
  assert.equal(f.core.snapshot().dayBlocks.phase, "running");
  f.add(1);
  assert.equal(f.core.snapshot().dayBlocks.phase, "task-due");
  assert.equal(f.core.snapshot().dayBlocks.task.id, "read");
  f.core.execute("dayblock", {
    type: "task.advance",
    expectedRunId: id,
    expectedTaskId: "read",
  });
  f.add(60000);
  assert.equal(f.core.snapshot().dayBlocks.phase, "block-due");
  assert.equal(f.core.snapshot().dayBlocks.task.id, "write");
  f.add(86400000 * 3);
  assert.equal(f.core.snapshot().dayBlocks.current.id, id);
  next(f);
  const view = f.core.snapshot().dayBlocks;
  assert.equal(view.current.blockId, "b");
  assert.equal(view.elapsedMilliseconds, 0);
  assert.equal(view.current.blockSnapshot.durationMinutes, 1);
  assert.equal(f.core.status().lifetimeXp, 0);
});
test("rapid distinct requests and stale input cannot skip blocks or tasks", (t) => {
  const f = fixture(t);
  save(f);
  const pid = f.core.snapshot().dayBlocks.plan.id;
  const command = {
    type: "block.start",
    expectedPlanId: pid,
    expectedRevision: f.core.snapshot().dayBlocks.plan.revision,
    blockId: "a",
  };
  f.core.execute("dayblock", command);
  f.core.execute("dayblock", command);
  assert.equal(f.core.snapshot().dayBlocks.runs.length, 1);
  const run = f.core.snapshot().dayBlocks.current.id;
  const advance = {
    type: "task.advance",
    expectedRunId: run,
    expectedTaskId: "read",
  };
  f.core.execute("dayblock", advance);
  f.core.execute("dayblock", advance);
  assert.equal(f.core.snapshot().dayBlocks.current.taskIndex, 1);
  f.add(120000);
  const transition = { type: "block.next", expectedRunId: run };
  f.core.execute("dayblock", transition);
  f.core.execute("dayblock", transition);
  assert.equal(f.core.snapshot().dayBlocks.runs.length, 2);
  assert.equal(f.core.snapshot().dayBlocks.current.blockId, "b");
});
test("elapsed includes breaks, midnight and restart without altering focused Session semantics", (t) => {
  const f = fixture(t);
  save(f);
  start(f);
  f.core.execute("session", {
    type: "session.start",
    session: { primarySkill: "general/focus" },
  });
  f.add(30000);
  f.core.execute("session", { type: "session.pause" });
  const focused = f.core.snapshot().summary.focusedMilliseconds;
  f.add(90000);
  f.reopen();
  assert.equal(f.core.snapshot().dayBlocks.elapsedMilliseconds, 120000);
  assert.equal(f.core.snapshot().dayBlocks.phase, "block-due");
  assert.equal(f.core.snapshot().summary.focusedMilliseconds, focused);
  assert.equal(f.core.snapshot().session.activeSession.status, "paused");
  assert.equal(f.core.status().lifetimeXp, 0);
  f.add(86400000);
  f.reopen();
  assert.equal(f.core.snapshot().dayBlocks.runs.length, 1);
  assert.equal(f.core.snapshot().dayBlocks.phase, "block-due");
});
test("failed next transition preserves both state and journal then commits end/start together", (t) => {
  const f = fixture(t);
  save(f);
  start(f);
  f.add(120000);
  const before = f.core.exportState();
  f.core.write = () => {
    throw Error("Disk full");
  };
  assert.throws(() => next(f), /Disk full/);
  assert.equal(f.core.exportState(), before);
  f.core.write = atomicWrite;
  f.reopen();
  assert.equal(f.core.snapshot().dayBlocks.current.blockId, "a");
  next(f);
  const last = f.core.journal.events.slice(-2).map((e) => e.type);
  assert.deepEqual(last, ["dayblocks.block.ended", "dayblocks.block.started"]);
});
test("plan freezes after selected start and ends only with explicit final action", (t) => {
  const f = fixture(t);
  save(f);
  start(f, "b");
  assert.throws(() => save(f), /frozen/);
  f.add(60000);
  f.reopen();
  const v = f.core.snapshot().dayBlocks;
  assert.equal(v.phase, "block-due");
  assert.equal(v.runs.length, 1);
  assert.equal(v.current.blockId, "b");
  assert.equal(v.next, null);
  assert.equal(f.core.snapshot().planning.tasks.length, 0);
  f.core.execute("dayblock", {
    type: "plan.finish",
    expectedRunId: v.current.id,
  });
  assert.equal(f.core.snapshot().dayBlocks.phase, "finished");
  const oldId = f.core.snapshot().dayBlocks.plan.id;
  f.core.execute("dayblock", { type: "plan.new", expectedPlanId: oldId });
  f.core.execute("dayblock", { type: "plan.new", expectedPlanId: oldId });
  assert.equal(f.core.snapshot().dayBlocks.plan.blocks.length, 0);
  assert.notEqual(f.core.snapshot().dayBlocks.plan.id, oldId);
  assert.equal(
    f.core.journal.events.filter((e) => e.type === "dayblocks.plan.finished")
      .length,
    1,
  );
});
test("ordered plans replay with empty and long tasks; stale edits and invalid fields are rejected", (t) => {
  const f = fixture(t);
  save(f, [
    { ...plan[1], tasks: [] },
    { ...plan[0], title: "x".repeat(240) },
  ]);
  f.reopen();
  assert.deepEqual(
    f.core.snapshot().dayBlocks.plan.blocks.map((b) => b.id),
    ["b", "a"],
  );
  assert.throws(
    () =>
      f.core.execute("dayblock", {
        type: "plan.save",
        expectedRevision: 0,
        blocks: plan,
      }),
    /changed/,
  );
  assert.throws(() => save(f, [{ ...plan[0], durationMinutes: 0 }]), /minutes/);
  start(f, "b");
  assert.equal(f.core.snapshot().dayBlocks.task, null);
  f.add(60000);
  assert.equal(f.core.snapshot().dayBlocks.phase, "block-due");
});
test("block commands leave canonical planning and XP unchanged; exported block state roundtrips", (t) => {
  const f = fixture(t);
  f.core.execute("planning", {
    type: "task.create",
    task: {
      id: "work",
      title: "Unfinished",
      estimateMinutes: 20,
      urgency: "normal",
      primarySkill: "general/focus",
      deadline: null,
    },
  });
  const before = f.core.snapshot().planning;
  save(f);
  start(f);
  f.add(120000);
  next(f);
  f.add(60000);
  f.core.execute("dayblock", {
    type: "plan.finish",
    expectedRunId: f.core.snapshot().dayBlocks.current.id,
  });
  assert.deepEqual(f.core.snapshot().planning, before);
  assert.equal(f.core.status().lifetimeXp, 0);
  const events = require("../../../EventModel.js").loadJournal(
    f.core.exportJournal(),
  ).journal.events;
  assert.deepEqual(Blocks.project(events), f.core.projections.dayblock);
});
test("stale saves cannot overwrite a new plan and stale starts cannot use changed targets", (t) => {
  const f = fixture(t);
  save(f, [plan[1]]);
  const old = f.core.snapshot().dayBlocks.plan;
  save(f, [{ ...plan[1], durationMinutes: 2 }]);
  f.core.execute("dayblock", {
    type: "block.start",
    expectedPlanId: old.id,
    expectedRevision: old.revision,
    blockId: "b",
  });
  assert.equal(f.core.snapshot().dayBlocks.current, null);
  start(f, "b");
  f.add(120000);
  f.core.execute("dayblock", {
    type: "plan.finish",
    expectedRunId: f.core.snapshot().dayBlocks.current.id,
  });
  f.core.execute("dayblock", { type: "plan.new", expectedPlanId: old.id });
  assert.equal(f.core.snapshot().dayBlocks.plan.revision, 1);
  assert.throws(
    () =>
      f.core.execute("dayblock", {
        type: "plan.save",
        expectedPlanId: old.id,
        expectedRevision: 1,
        blocks: plan,
      }),
    /changed/,
  );
  assert.equal(f.core.snapshot().dayBlocks.plan.blocks.length, 0);
});
test("clock rollback rejects a task transition before writing and keeps restart readable", (t) => {
  const f = fixture(t);
  save(f);
  start(f);
  f.add(30000);
  f.core.execute("dayblock", {
    type: "task.advance",
    expectedRunId: f.core.snapshot().dayBlocks.current.id,
    expectedTaskId: "read",
  });
  const before = f.core.exportState();
  f.add(-10000);
  assert.throws(
    () =>
      f.core.execute("dayblock", {
        type: "task.advance",
        expectedRunId: f.core.snapshot().dayBlocks.current.id,
        expectedTaskId: "write",
      }),
    /backwards/,
  );
  assert.equal(f.core.exportState(), before);
  f.reopen();
  assert.equal(f.core.snapshot().dayBlocks.task.id, "write");
});
test("semantically invalid imported block events are rejected before disk changes", (t) => {
  const f = fixture(t),
    Event = require("../../../EventModel.js");
  const malformed = Event.append(
    f.core.journal,
    Event.createEvent({
      ...f.core.context(),
      deviceId: f.core.journal.deviceId,
      type: "dayblocks.block.started",
      payload: {
        runId: "invalid",
        planId: "missing",
        blockId: "missing",
        atUtc: f.core.clock().toISOString(),
      },
    }),
  );
  const before = f.core.exportState();
  assert.throws(
    () => f.core.importLegacy(Event.exportCheckedJournal(malformed)),
    /Invalid block start/,
  );
  assert.equal(f.core.exportState(), before);
  f.reopen();
  assert.equal(f.core.snapshot().dayBlocks.phase, "ready");
});
