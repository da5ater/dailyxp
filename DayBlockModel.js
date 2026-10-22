function copy(value) {
  return JSON.parse(JSON.stringify(value));
}
function text(value, field) {
  if (typeof value !== "string" || !value.trim() || value.length > 240)
    throw new Error(field + " must contain 1 to 240 characters");
  return value.trim();
}
function minutes(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 1440)
    throw new Error(field + " must be 1 to 1440 minutes");
  return value;
}
function instant(value) {
  if (
    typeof value !== "string" ||
    isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error("Invalid block timestamp");
  return value;
}
function blocks(value) {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("A plan needs at most 100 blocks");
  var ids = new Set();
  return value.map(function (item) {
    var id = text(item.id, "Block ID");
    if (ids.has(id)) throw new Error("Duplicate block");
    ids.add(id);
    if (!Array.isArray(item.tasks) || item.tasks.length > 100)
      throw new Error("A block needs at most 100 tasks");
    var taskIds = new Set();
    return {
      id: id,
      title: text(item.title, "Block name"),
      durationMinutes: minutes(item.durationMinutes, "Block duration"),
      tasks: item.tasks.map(function (task) {
        var taskId = text(task.id, "Task ID");
        if (taskIds.has(taskId)) throw new Error("Duplicate block task");
        taskIds.add(taskId);
        return {
          id: taskId,
          title: text(task.title, "Task name"),
          targetMinutes: minutes(task.targetMinutes, "Task target"),
        };
      }),
    };
  });
}
function currentRun(state) {
  return (
    state.runs.find(function (run) {
      return run.endedAtUtc === null;
    }) || null
  );
}
function apply(state, event) {
  var p = event.payload;
  var current = currentRun(state);
  if (event.type === "dayblocks.plan.saved") {
    if (
      current ||
      (state.runs.some(function (run) {
        return run.planId === state.plan.id;
      }) &&
        !state.plan.finishedAtUtc)
    )
      throw new Error("The started plan is frozen");
    var same = state.plan.id === p.planId;
    if (
      (same && p.revision !== state.plan.revision + 1) ||
      (!same && p.revision !== 1)
    )
      throw new Error("Invalid plan revision");
    state.plan = {
      id: text(p.planId, "Plan ID"),
      revision: p.revision,
      blocks: blocks(p.blocks),
      finishedAtUtc: null,
    };
  }
  if (event.type === "dayblocks.block.started") {
    if (current || state.plan.finishedAtUtc || p.planId !== state.plan.id)
      throw new Error("Invalid block start");
    var selected = state.plan.blocks.find(function (block) {
      return block.id === p.blockId;
    });
    if (
      !selected ||
      state.runs.some(function (run) {
        return run.id === p.runId;
      })
    )
      throw new Error("Invalid block identity");
    var previous = state.runs
      .filter(function (run) {
        return run.planId === p.planId;
      })
      .slice(-1)[0];
    if (
      previous &&
      (state.plan.blocks[previous.blockIndex + 1] !== selected ||
        Date.parse(p.atUtc) < Date.parse(previous.endedAtUtc))
    )
      throw new Error("Invalid next block");
    state.runs.push({
      id: text(p.runId, "Run ID"),
      planId: p.planId,
      blockId: selected.id,
      blockIndex: state.plan.blocks.indexOf(selected),
      blockSnapshot: copy(selected),
      startedAtUtc: instant(p.atUtc),
      taskIndex: 0,
      taskStartedAtUtc: p.atUtc,
      advancedTasks: [],
      endedAtUtc: null,
    });
  }
  if (event.type === "dayblocks.task.advanced") {
    if (
      !current ||
      current.id !== p.runId ||
      current.blockSnapshot.tasks[current.taskIndex]?.id !== p.taskId ||
      Date.parse(instant(p.atUtc)) < Date.parse(current.taskStartedAtUtc) ||
      Date.parse(p.atUtc) >=
        Date.parse(current.startedAtUtc) +
          current.blockSnapshot.durationMinutes * 60000
    )
      throw new Error("Invalid task transition");
    current.advancedTasks.push({ taskId: p.taskId, advancedAtUtc: p.atUtc });
    current.taskIndex += 1;
    current.taskStartedAtUtc = p.atUtc;
  }
  if (event.type === "dayblocks.block.ended") {
    if (
      !current ||
      current.id !== p.runId ||
      Date.parse(instant(p.atUtc)) <
        Date.parse(current.startedAtUtc) +
          current.blockSnapshot.durationMinutes * 60000
    )
      throw new Error("The block has not reached its duration");
    current.endedAtUtc = p.atUtc;
  }
  if (event.type === "dayblocks.plan.finished") {
    var last = state.runs[state.runs.length - 1];
    if (
      current ||
      p.planId !== state.plan.id ||
      !last ||
      last.planId !== p.planId ||
      last.blockIndex !== state.plan.blocks.length - 1 ||
      Date.parse(instant(p.atUtc)) < Date.parse(last.endedAtUtc)
    )
      throw new Error("Invalid plan finish");
    state.plan.finishedAtUtc = p.atUtc;
  }
}
function project(events) {
  var state = {
    plan: { id: null, revision: 0, blocks: [], finishedAtUtc: null },
    runs: [],
  };
  events.forEach(function (event) {
    if (event.type.indexOf("dayblocks.") === 0) apply(state, event);
  });
  if (
    !currentRun(state) &&
    state.runs.some(function (run) {
      return run.planId === state.plan.id;
    }) &&
    !state.plan.finishedAtUtc
  )
    throw new Error("Incomplete block transition");
  return state;
}
function viewAt(state, atUtc) {
  var now = Date.parse(instant(atUtc));
  var current = currentRun(state);
  var elapsed = current
    ? Math.max(0, now - Date.parse(current.startedAtUtc))
    : 0;
  var task = current
    ? current.blockSnapshot.tasks[current.taskIndex] || null
    : null;
  var phase = !current
    ? state.plan.finishedAtUtc
      ? "finished"
      : "ready"
    : elapsed >= current.blockSnapshot.durationMinutes * 60000
      ? "block-due"
      : task &&
          now - Date.parse(current.taskStartedAtUtc) >=
            task.targetMinutes * 60000
        ? "task-due"
        : "running";
  return {
    plan: state.plan,
    runs: state.runs.filter(function (run) {
      return run.planId === state.plan.id;
    }),
    current: current,
    task: task,
    phase: phase,
    elapsedMilliseconds: elapsed,
    taskElapsedMilliseconds: current
      ? Math.max(0, now - Date.parse(current.taskStartedAtUtc))
      : 0,
    next: current ? state.plan.blocks[current.blockIndex + 1] || null : null,
    editable: phase === "ready",
    promptId:
      phase === "block-due"
        ? current.id + ":end"
        : phase === "task-due"
          ? current.id + ":task:" + task.id
          : null,
  };
}
function decide(state, command) {
  if (
    [
      "plan.save",
      "plan.new",
      "block.start",
      "task.advance",
      "block.next",
      "plan.finish",
    ].indexOf(command.type) === -1
  )
    throw new Error("Unsupported day block command");
  var view = viewAt(state, command.atUtc);
  var p = state.plan;
  var payload;
  if (command.type === "plan.save") {
    if (!view.editable)
      throw new Error(
        "The started plan is frozen. Finish it before creating a new plan.",
      );
    if (
      command.expectedPlanId !== p.id ||
      command.expectedRevision !== p.revision
    )
      throw new Error("The plan changed. Reopen the editor and try again.");
    var updated = blocks(command.blocks);
    if (JSON.stringify(updated) === JSON.stringify(p.blocks))
      return { events: [] };
    return {
      events: [
        {
          type: "dayblocks.plan.saved",
          payload: {
            planId: p.id || text(command.planId, "Plan ID"),
            revision: p.revision + 1,
            blocks: updated,
          },
        },
      ],
    };
  }
  if (command.type === "plan.new") {
    if (command.expectedPlanId !== p.id) return { events: [] };
    if (view.phase !== "finished")
      throw new Error("Finish this plan before starting a new one");
    return {
      events: [
        {
          type: "dayblocks.plan.saved",
          payload: {
            planId: text(command.planId, "Plan ID"),
            revision: 1,
            blocks: [],
          },
        },
      ],
    };
  }
  if (command.type === "block.start") {
    if (
      command.expectedPlanId !== p.id ||
      command.expectedRevision !== p.revision ||
      view.phase !== "ready"
    )
      return { events: [] };
    if (
      !p.blocks.some(function (block) {
        return block.id === command.blockId;
      })
    )
      throw new Error("Block was not found");
    return {
      events: [
        {
          type: "dayblocks.block.started",
          payload: {
            runId: text(command.newRunId, "Run ID"),
            planId: p.id,
            blockId: command.blockId,
            atUtc: command.atUtc,
          },
        },
      ],
    };
  }
  var run = view.current;
  if (!run || command.expectedRunId !== run.id) return { events: [] };
  if (command.type === "task.advance") {
    if (
      !view.task ||
      command.expectedTaskId !== view.task.id ||
      view.phase === "block-due"
    )
      return { events: [] };
    if (Date.parse(command.atUtc) < Date.parse(run.taskStartedAtUtc))
      throw new Error(
        "The clock moved backwards. Check the system time before moving on.",
      );
    payload = { runId: run.id, taskId: view.task.id, atUtc: command.atUtc };
    return { events: [{ type: "dayblocks.task.advanced", payload: payload }] };
  }
  if (command.type === "block.next" || command.type === "plan.finish") {
    if (view.phase !== "block-due")
      throw new Error("The block is still counting elapsed time");
    var ended = {
      type: "dayblocks.block.ended",
      payload: { runId: run.id, atUtc: command.atUtc },
    };
    if (command.type === "block.next") {
      if (!view.next)
        throw new Error("This is the last block. Finish the plan.");
      return {
        events: [
          ended,
          {
            type: "dayblocks.block.started",
            payload: {
              runId: text(command.newRunId, "Run ID"),
              planId: p.id,
              blockId: view.next.id,
              atUtc: command.atUtc,
            },
          },
        ],
      };
    }
    if (view.next)
      throw new Error("More blocks remain. Start the next block when ready.");
    return {
      events: [
        ended,
        {
          type: "dayblocks.plan.finished",
          payload: { planId: p.id, atUtc: command.atUtc },
        },
      ],
    };
  }
  throw new Error("Unsupported day block command");
}
if (typeof module !== "undefined" && module.exports)
  module.exports = { project: project, decide: decide, viewAt: viewAt };
