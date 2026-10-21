import { editorFields, editorCommand } from "./editor.js";
import { escape, time } from "./view-utils.js";
import { renderView } from "./views.js";
const root = document.querySelector("#app");
const dialog = document.querySelector("#editor");
let state,
  surface = "Play";
let selectedId = null,
  editing = null,
  busy = false,
  privateOpen = false,
  noticeTimer,
  sampledAt = Date.now();
const collection = () => [
  ...state.planning.tasks,
  ...state.planning.occurrences,
];
const taskFor = (id) => collection().find((t) => t.id === id);
function notice(text) {
  clearTimeout(noticeTimer);
  document.querySelector("#notice").textContent = text;
  noticeTimer = setTimeout(
    () => (document.querySelector("#notice").textContent = ""),
    6000,
  );
}
async function invoke(message) {
  const response = await window.dailyxp.invoke(message);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
async function refresh() {
  state = await invoke({ action: "snapshot" });
  sampledAt = Date.now();
  selectedId ||= state.session.selection?.taskId;
  if (!state.session.activeSession && taskFor(selectedId)?.status !== "open")
    selectedId = null;
  render();
}
async function command(domain, value) {
  if (busy) return null;
  busy = true;
  root.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    const result = await invoke({
      action: "command",
      domain,
      command: value,
      requestId: crypto.randomUUID(),
    });
    await refresh();
    return result;
  } finally {
    busy = false;
    root.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}
function focusControl(action, id) {
  const controls = [...root.querySelectorAll("button[data-action]")];
  const control = controls.find(
    (button) =>
      button.dataset.action === action &&
      (id === undefined || button.dataset.id === id),
  );
  (control || root.querySelector('[aria-current="page"]'))?.focus({
    preventScroll: true,
  });
}
function render() {
  const focused = root.contains(document.activeElement)
    ? {
        action: document.activeElement.dataset.action,
        id: document.activeElement.dataset.id,
      }
    : null;
  document.body.dataset.reduced = state.settings.reducedMotion;
  root.innerHTML = `<div class="app">${location.hash === "#review" ? '<div class="preview">REVIEW PROFILE · DEMO DATA · Separate from personal progress</div>' : ""}<header class="topbar"><div class="brand">DAILYXP</div><nav aria-label="Main navigation">${["Play", "Plan", "Journey", "World", "Settings"].map((name) => `<button data-action="navigate" data-id="${name}" ${surface === name ? 'aria-current="page"' : ""}>${name}</button>`).join("")}</nav><span class="local">SAVED LOCALLY</span></header><main>${renderView({ state, surface, selectedId, privateOpen })}</main><footer class="footer"><span>Level ${state.progression.level} · ${escape(state.progression.storyRank)}</span><span>${state.progression.totals.lifetimeXp.toLocaleString()} Lifetime XP</span><span>Saved on this device · revision ${state.revision}</span></footer></div>`;
  if (focused?.action) {
    const next = {
      start: "pause",
      pause: "resume",
      resume: "pause",
      finish: "start",
      "complete-habit": "undo-habit",
      "undo-habit": "complete-habit",
    };
    const existing = [...root.querySelectorAll("button[data-action]")].some(
      (button) =>
        button.dataset.action === focused.action &&
        button.dataset.id === focused.id,
    );
    focusControl(
      existing ? focused.action : next[focused.action] || "new",
      existing ? focused.id : undefined,
    );
  }
}
function edit(kind, item = null, goalId = null) {
  editing = { kind, item, goalId };
  document.querySelector("#editor-title").textContent =
    kind === "session"
      ? "Correct Session"
      : `${item ? "Edit" : "New"} ${kind === "task" ? "commitment" : kind}`;
  document.querySelector("#form-error").textContent = "";
  document.querySelector("#fields").innerHTML = editorFields(
    kind,
    item,
    goalId,
    state,
  );
  dialog.showModal();
  dialog.querySelector("input,textarea,select")?.focus();
}
async function saveEditor(event) {
  event.preventDefault();
  if (busy) return;
  try {
    const { domain, value } = editorCommand(
      editing,
      new FormData(event.target),
      state,
    );
    let result = await command(domain, value);
    if (
      result?.confirmation &&
      confirm(
        "This correction changes competitive XP. Apply it, including any planned overtime?",
      )
    )
      result = await command(domain, {
        ...value,
        competitiveChangeConfirmed: true,
        plannedDurationDecision: "include-overtime",
      });
    if (result?.confirmation) return;
    dialog.close();
    focusControl("new", editing.kind);
    notice("Saved on this device.");
  } catch (error) {
    document.querySelector("#form-error").textContent = error.message;
  }
}
async function action(name, id) {
  if (busy) return;
  if (name === "navigate") {
    surface = id;
    if (id !== "Recovery") privateOpen = false;
    render();
    return;
  }
  if (name === "close-editor") {
    dialog.close();
    return;
  }
  if (name === "new") {
    edit(id);
    return;
  }
  if (name === "new-milestone") {
    edit("milestone", null, id);
    return;
  }
  if (name.startsWith("edit-")) {
    const kind = name.slice(5);
    edit(
      kind,
      (kind === "habit"
        ? state.habit.habits
        : kind === "session"
          ? state.session.sessions
          : state.planning[`${kind}s`]
      ).find((i) => i.id === id),
    );
    return;
  }
  if (name === "unlock-recovery") {
    privateOpen = true;
    render();
    return;
  }
  if (name === "lock-recovery") {
    privateOpen = false;
    render();
    return;
  }
  if (name === "checkin") {
    edit("checkin", { id });
    return;
  }
  if (name === "select") {
    selectedId = id;
    await command("session", { type: "selection.change", taskId: id });
    return;
  }
  if (name === "start" || name === "free") {
    const task = name === "free" ? null : taskFor(selectedId);
    await command("session", {
      type: "session.start",
      session: {
        taskId: task?.id || null,
        primarySkill: task?.primarySkill || "general/focus",
        plannedMinutes: task?.estimateMinutes || task?.expectedMinutes || null,
      },
    });
    return;
  }
  if (name === "pause" || name === "resume") {
    await command("session", { type: `session.${name}` });
    return;
  }
  if (name === "discard") {
    if (confirm("Discard this Session? No XP will be awarded for it."))
      await command("session", { type: "session.discard" });
    return;
  }
  if (name === "idle-include" || name === "idle-exclude") {
    await command("session", {
      type: "session.inactivity.resolve",
      decision: name.slice(5),
    });
    return;
  }
  if (name === "finish") {
    if (state.session.activeSession?.pendingInactivityStartedAtUtc) {
      await command("session", { type: "session.inactivity.return" });
      notice("Choose whether to include the time away before finishing.");
      return;
    }
    let result = await command("session", { type: "session.finish" });
    if (
      result?.confirmation &&
      confirm(
        "The Session exceeded its plan. Include the additional focused time in competitive scoring?",
      )
    )
      result = await command("session", {
        type: "session.finish",
        plannedDurationDecision: "include-overtime",
      });
    else if (result?.confirmation)
      result = await command("session", {
        type: "session.finish",
        plannedDurationDecision: "exclude-overtime",
      });
    if (!result?.confirmation)
      notice("Session saved. Your Task remains separate.");
    return;
  }
  if (name === "complete-task") {
    const task = taskFor(id);
    await command("planning", {
      type: task.routineId ? "occurrence.transition" : "task.transition",
      id,
      status: "completed",
    });
    return;
  }
  if (name === "dismiss-reminder") {
    await command("session", { type: "selection.reminder.dismiss" });
    return;
  }
  if (name === "remove-habit") {
    if (confirm("Remove this Habit? Completed history will remain."))
      await command("habit", { type: "habit.remove", id });
    return;
  }
  if (name === "toggle-goal") {
    const goal = state.planning.goals.find((g) => g.id === id);
    await command("planning", {
      type: "goal.transition",
      id,
      status: goal.status === "paused" ? "active" : "paused",
    });
    return;
  }
  if (name === "complete-habit" || name === "undo-habit") {
    await command("habit", {
      type: name === "complete-habit" ? "habit.complete" : "habit.uncomplete",
      habitId: id,
      dailyXpDate: state.date,
    });
    return;
  }
  if (name.startsWith("overdue-")) {
    await command("planning", {
      type: "overdue.disposition",
      id,
      action: name.slice(8),
      dailyXpDate: state.date,
    });
    return;
  }
  if (name === "remove-routine") {
    if (
      confirm("Remove this Routine? Recorded history remains in the journal.")
    )
      await command("planning", {
        type: "entity.remove",
        entityType: "routine",
        id,
      });
    return;
  }
  if (name === "achieve-goal") {
    await command("planning", {
      type: "goal.transition",
      id,
      status: "achieved",
    });
    return;
  }
  if (name === "complete-milestone") {
    const m = state.planning.milestones.find((m) => m.id === id);
    await command("planning", {
      type: "milestone.progress",
      id,
      progress: m.measurement.target || 1,
    });
    return;
  }
  if (name === "relapse") {
    if (confirm("Record a setback today? Earned progress remains yours."))
      await command("recovery", {
        type: "recovery.relapse",
        trackId: id,
        dailyXpDate: state.date,
      });
    return;
  }
  if (name === "restart-recovery") {
    await command("recovery", {
      type: "recovery.restart",
      trackId: id,
      dailyXpDate: state.date,
    });
    return;
  }
  if (name === "save-settings") {
    const data = new FormData(document.querySelector("#settings-form"));
    await invoke({
      action: "settings",
      changes: {
        dailyTargetMinutes: Number(data.get("dailyTargetMinutes")),
        dayBoundaryMinutes: Number(data.get("dayBoundaryMinutes")),
        reducedMotion: data.get("reducedMotion") === "on",
        notifications: data.get("notifications") === "on",
      },
    });
    await refresh();
    notice("Settings saved.");
    return;
  }
  if (name === "import" || name === "export") {
    await invoke({ action: name });
    await refresh();
  }
}
document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (control) {
    event.preventDefault();
    action(control.dataset.action, control.dataset.id).catch((error) =>
      notice(error.message),
    );
  }
});
document.querySelector("#edit-form").addEventListener("submit", saveEditor);
document.addEventListener("submit", (event) => {
  if (event.target.id === "settings-form") {
    event.preventDefault();
    action("save-settings").catch((error) => notice(error.message));
  }
});
window.dailyxp.onChange(() => {
  if (!busy) refresh().catch((error) => notice(error.message));
});
setInterval(() => {
  const timer = document.querySelector("#session-timer");
  if (timer && state?.session.activeSession)
    timer.textContent = time(
      state.summary.focusedMilliseconds +
        (state.session.activeSession.status === "running"
          ? Date.now() - sampledAt
          : 0),
    );
}, 1000);
refresh().catch((error) => {
  root.textContent = `DailyXP could not open this profile. ${error.message}`;
});
