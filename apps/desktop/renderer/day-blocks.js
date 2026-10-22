import { escape, button, time } from "./view-utils.js";
export function renderDayBlocks(view) {
  const { current, task, phase, next, plan } = view;
  const running = phase === "running" || phase === "task-due";
  const prompt =
    phase === "block-due"
      ? `<div class="block-prompt" role="status"><h2>${escape(current.blockSnapshot.title)} reached its time limit.</h2><p>Unfinished tasks stay unfinished. ${next ? `Start ${escape(next.title)} when you are ready. Its full duration begins with your click.` : "This is your last block. Finish the plan when you are ready."}</p>${next ? button("Start next block", "block-next", current.id, "primary") : button("Finish plan", "block-finish", current.id, "primary")}</div>`
      : phase === "task-due"
        ? `<div class="block-prompt" role="status"><h2>Time to move on?</h2><p>${escape(task.title)} reached its target. The block clock keeps counting while you decide.</p>${button(current.taskIndex + 1 < current.blockSnapshot.tasks.length ? "Next task" : "Continue block", "block-advance", task.id, "primary")}</div>`
        : "";
  const active = current
    ? `<section class="block-active" aria-label="Current day block"><div class="eyebrow">${phase === "block-due" ? "BLOCK TIME REACHED" : "ALL ELAPSED TIME COUNTS"}</div><h2>${escape(current.blockSnapshot.title)}</h2><div class="block-clock"><span id="block-elapsed" aria-label="Block elapsed time">${time(view.elapsedMilliseconds)}</span><span class="hint"> / ${current.blockSnapshot.durationMinutes} min</span></div><p class="hint">Breaks and time away count. This does not start or change a focused Session.</p>${task ? `<div class="block-current-task"><h3>${escape(task.title)}</h3><p><span id="block-task-elapsed">${time(view.taskElapsedMilliseconds)}</span> / ${task.targetMinutes} min target</p>${running && phase !== "task-due" ? button("Next task", "block-advance", task.id) : ""}</div>` : "<p>All task targets have been visited. The block clock continues.</p>"}${prompt}</section>`
    : "";
  const finished =
    phase === "finished"
      ? `<section class="block-prompt" role="status"><h2>Day plan finished.</h2><p>Time targets have ended. No Tasks were marked complete and no XP was awarded.</p>${button("New day plan", "block-new-plan", plan.id, "primary")}</section>`
      : "";
  const cards = plan.blocks
    .map((block, index) => {
      const run = view.runs.find((r) => r.blockId === block.id);
      const label = run
        ? run.endedAtUtc
          ? "Time ended · work not marked complete"
          : "Current block"
        : "Not started";
      return `<article class="block-card" data-block-id="${escape(block.id)}" aria-label="${escape(block.title)}"><div class="rowhead"><div><div class="eyebrow">BLOCK ${index + 1} · ${block.durationMinutes} MIN</div><h2>${escape(block.title)}</h2></div><span class="hint">${label}</span></div><ol class="block-task-list">${block.tasks.map((t) => `<li><span>${escape(t.title)}</span><span class="hint">${t.targetMinutes} min${run?.advancedTasks.some((a) => a.taskId === t.id) ? " · moved on" : ""}</span></li>`).join("") || '<li class="hint">No task targets. Use the whole block freely.</li>'}</ol>${view.editable ? `<div class="inline">${button("Start block", "block-start", block.id, "primary")}${button("Edit block", "block-edit", block.id)}<button data-action="block-up" data-id="${escape(block.id)}" ${index === 0 ? "disabled" : ""}>Move block up</button><button data-action="block-down" data-id="${escape(block.id)}" ${index === plan.blocks.length - 1 ? "disabled" : ""}>Move block down</button>${button("Remove block", "block-remove", block.id)}</div>${index ? '<p class="hint">Starting here leaves earlier blocks unstarted.</p>' : ""}` : ""}</article>`;
    })
    .join("");
  return `<div class="heading"><div><div class="eyebrow">Your day, in order</div><h1 class="block-heading">Make room for the whole day.</h1></div></div><p class="hint">Set an order and time targets. Every start and transition waits for your click.</p>${active}${finished}<div class="rowhead block-plan-heading"><h2>Day blocks</h2>${view.editable ? button("+ Block", "block-add", "", "primary") : '<span class="hint">Plan order is locked until you finish.</span>'}</div>${cards || '<div class="empty"><p>No day blocks yet.</p><p>Add a block for one part of your day, then add its task targets.</p></div>'}`;
}
export function taskRow(task = {}) {
  const id = task.id || crypto.randomUUID();
  return `<fieldset class="block-task-row" data-task-row="${escape(id)}"><legend>Task target</legend><input type="hidden" name="blockTaskId" value="${escape(id)}"><label>Task name<input name="blockTaskTitle" required maxlength="240" value="${escape(task.title || "")}"></label><label>Target minutes<input name="blockTaskMinutes" type="number" min="1" max="1440" required value="${task.targetMinutes || 15}"></label><div class="inline">${button("Move task up", "block-row-up", id)}${button("Move task down", "block-row-down", id)}${button("Remove task target", "block-row-remove", id)}</div></fieldset>`;
}
export function blockFields(item) {
  return `<label>Block name<input name="title" maxlength="240" required value="${escape(item?.title || "")}"></label><label>Block duration in minutes<input name="durationMinutes" type="number" min="1" max="1440" required value="${item?.durationMinutes || 60}"></label><p class="hint">Task targets prompt you to move on. They do not complete work or award XP.</p><div id="block-task-rows">${(item?.tasks || []).map(taskRow).join("")}</div>${button("+ Task target", "block-add-row")}`;
}
export function blockEditorCommand(editing, data, state) {
  const plan = state.dayBlocks.plan;
  const ids = data.getAll("blockTaskId"),
    titles = data.getAll("blockTaskTitle"),
    targets = data.getAll("blockTaskMinutes");
  const block = {
    id: editing.item?.id || crypto.randomUUID(),
    title: String(data.get("title")).trim(),
    durationMinutes: Number(data.get("durationMinutes")),
    tasks: ids.map((id, index) => ({
      id,
      title: String(titles[index]).trim(),
      targetMinutes: Number(targets[index]),
    })),
  };
  const blocks = plan.blocks.slice();
  const index = blocks.findIndex((item) => item.id === block.id);
  if (index < 0) blocks.push(block);
  else blocks[index] = block;
  return {
    domain: "dayblock",
    value: {
      type: "plan.save",
      expectedRevision: editing.planRevision,
      expectedPlanId: editing.planId,
      blocks,
    },
  };
}
