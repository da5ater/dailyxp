import { escape } from "./view-utils.js";
const input = (label, name, value = "", type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`;
const select = (label, name, options, value) =>
  `<label>${label}<select name="${name}">${options.map(([id, text]) => `<option value="${escape(id)}" ${id === value ? "selected" : ""}>${escape(text)}</option>`).join("")}</select></label>`;
function scheduleKind(schedule) {
  if (schedule?.type === "interval") return "interval";
  if (schedule?.type === "daily" || !schedule) return "daily";
  const days = schedule.weekdays.join(",");
  if (days === "1,2,3,4,5,6,7") return "daily";
  if (days === "1,2,3,4,5") return "weekdays";
  if (days === "6,7") return "weekends";
  return "custom";
}
export function editorFields(kind, item, goalId, state) {
  let fields = "";
  if (["task", "routine", "habit", "goal", "milestone"].includes(kind))
    fields += input(
      "Name",
      "title",
      item?.title,
      "text",
      'required maxlength="240"',
    );
  if (["task", "routine"].includes(kind))
    fields += input(
      "Planned minutes",
      "minutes",
      item?.estimateMinutes || item?.expectedMinutes || 25,
      "number",
      'required min="1" max="1440"',
    );
  if (["task", "routine", "goal", "session"].includes(kind))
    fields += input(
      "Primary Skill",
      "skill",
      item?.primarySkill || "general/focus",
      "text",
      'required maxlength="120"',
    );
  if (kind === "goal")
    fields +=
      `<label>Why this matters<textarea name="reason" required maxlength="1000">${escape(item?.reason)}</textarea></label>` +
      input("Target date (optional)", "targetDate", item?.targetDate, "date");
  if (["task", "routine", "milestone"].includes(kind)) {
    fields += select(
      "Goal (optional for a commitment)",
      "goalId",
      [["", "No Goal"], ...state.planning.goals.map((g) => [g.id, g.title])],
      item?.goalId || goalId || "",
    );
    if (kind !== "milestone")
      fields += select(
        "Milestone (optional)",
        "milestoneId",
        [
          ["", "No Milestone"],
          ...state.planning.milestones
            .filter(
              (m) => m.status !== "completed" || m.id === item?.milestoneId,
            )
            .map((m) => [m.id, m.title]),
        ],
        item?.milestoneId || "",
      );
  }
  if (kind === "task")
    fields += `<details><summary>Timing and urgency</summary>${select(
      "Urgency",
      "urgency",
      [
        ["low", "Low"],
        ["normal", "Normal"],
        ["high", "High"],
      ],
      item?.urgency || "normal",
    )}${input("Deadline (optional)", "deadline", item?.deadline, "date")}</details>`;
  if (["routine", "habit"].includes(kind)) {
    const selected = scheduleKind(item?.schedule);
    fields += select(
      "Scheduled days",
      "schedule",
      [
        ["daily", "Every day"],
        ["weekdays", "Monday to Friday"],
        ["weekends", "Saturday and Sunday"],
        ["custom", "Choose weekdays"],
        ["interval", "Every few days"],
      ],
      selected,
    );
    fields += `<details ${["custom", "interval"].includes(selected) ? "open" : ""}><summary>Schedule details</summary><div class="weekday-options">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => `<label class="inline"><input type="checkbox" name="day-${index + 1}" ${item?.schedule?.weekdays?.includes(index + 1) ? "checked" : ""}>${day}</label>`).join("")}</div>${input("Repeat every (days), for interval schedules", "everyDays", item?.schedule?.everyDays || 2, "number", 'min="1" max="366"')}${input("Start date", "startDate", item?.startDate || state.date, "date", "required")}${input("End date (optional)", "endDate", item?.endDate, "date")}${input("Rest dates (optional, comma-separated YYYY-MM-DD)", "restDates", (item?.restDates || []).join(", "))}</details>`;
  }
  if (kind === "routine")
    fields += `<label class="setting">Carry unfinished work forward<input name="carryover" type="checkbox" ${item?.carryover ? "checked" : ""}></label>`;
  if (kind === "milestone")
    fields +=
      select(
        "Measurement",
        "measurement",
        [
          ["binary", "Complete once"],
          ["numeric", "Numeric target"],
          ["time", "Focused time"],
          ["task", "Task count"],
          ["consistency", "Consistency"],
        ],
        item?.measurement?.type || "binary",
      ) +
      input(
        "Target (for measured Milestones)",
        "target",
        item?.measurement?.target || 1,
        "number",
        'min="1"',
      ) +
      input(
        "Significance",
        "significance",
        item?.significance || 1,
        "number",
        'required min="1" max="100"',
      );
  if (kind === "session")
    fields +=
      input(
        "Focused minutes",
        "focusedMinutes",
        Number((item.focusedMilliseconds / 60000).toFixed(4)),
        "number",
        'required min="0.0001" step="0.0001"',
      ) +
      '<p class="hint">The original gaps between focus segments remain. Changes that affect competitive XP need confirmation.</p>';
  if (kind === "recovery")
    fields +=
      input(
        "Private category name",
        "category",
        "",
        "text",
        'required maxlength="120"',
      ) + input("Attempt start date", "start", state.date, "date", "required");
  if (kind === "checkin")
    fields +=
      '<label>Private note<textarea name="note" maxlength="2000" required></textarea></label>';
  return fields;
}
function schedule(data, startDate) {
  const kind = data.get("schedule");
  if (kind === "interval")
    return {
      type: "interval",
      everyDays: Number(data.get("everyDays")),
      anchorDate: startDate,
    };
  const days =
    kind === "custom"
      ? [1, 2, 3, 4, 5, 6, 7].filter((day) => data.get(`day-${day}`) === "on")
      : kind === "weekdays"
        ? [1, 2, 3, 4, 5]
        : kind === "weekends"
          ? [6, 7]
          : [1, 2, 3, 4, 5, 6, 7];
  return { type: "weekdays", weekdays: days };
}
export function editorCommand({ kind, item, goalId }, data, state) {
  const id = item?.id || crypto.randomUUID();
  const title = String(data.get("title") || "").trim();
  const skill = String(data.get("skill") || "").trim();
  const chosenMilestone = state.planning.milestones.find(
    (m) => m.id === data.get("milestoneId"),
  );
  const links = {
    goalId: chosenMilestone?.goalId || data.get("goalId") || goalId || null,
    milestoneId: chosenMilestone?.id || null,
  };
  if (kind === "task") {
    const fields = {
      title,
      estimateMinutes: Number(data.get("minutes")),
      primarySkill: skill,
      urgency: data.get("urgency") || "normal",
      deadline: data.get("deadline") || null,
      ...links,
    };
    return {
      domain: "planning",
      value: item
        ? { type: "task.edit", id, changes: fields }
        : { type: "task.create", task: { id, ...fields } },
    };
  }
  if (kind === "routine" || kind === "habit") {
    const fields = {
      title,
      schedule: schedule(data, data.get("startDate")),
      startDate: data.get("startDate"),
      endDate: data.get("endDate") || null,
      restDates: String(data.get("restDates") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (kind === "routine")
      Object.assign(fields, {
        primarySkill: skill,
        expectedMinutes: Number(data.get("minutes")),
        carryover: data.get("carryover") === "on",
        ...links,
      });
    return {
      domain: kind === "habit" ? "habit" : "planning",
      value: item
        ? {
            type: `${kind}.edit`,
            id,
            changes: fields,
            ...(kind === "routine"
              ? { scope: "today_and_future", dailyXpDate: state.date }
              : {}),
          }
        : { type: `${kind}.create`, [kind]: { id, ...fields } },
    };
  }
  if (kind === "goal") {
    const fields = {
      title,
      primarySkill: skill,
      reason: String(data.get("reason")).trim(),
      targetDate: data.get("targetDate") || null,
    };
    return {
      domain: "planning",
      value: item
        ? { type: "goal.edit", id, changes: fields }
        : { type: "goal.create", goal: { id, ...fields } },
    };
  }
  if (kind === "milestone") {
    const type = data.get("measurement");
    const fields = {
      title,
      goalId: links.goalId,
      measurement:
        type === "binary"
          ? { type }
          : { type, target: Number(data.get("target")) },
      significance: Number(data.get("significance")),
    };
    return {
      domain: "planning",
      value: item
        ? { type: "milestone.edit", id, changes: fields }
        : { type: "milestone.create", milestone: { id, ...fields } },
    };
  }
  if (kind === "session") {
    const requestedMinutes = Number(data.get("focusedMinutes"));
    const unchangedDuration =
      requestedMinutes ===
      Number((item.focusedMilliseconds / 60000).toFixed(4));
    return {
      domain: "session",
      value: {
        type: "session.correct",
        id,
        focusedMilliseconds: unchangedDuration
          ? item.focusedMilliseconds
          : Math.round(requestedMinutes * 60000),
        changes: { primarySkill: skill },
      },
    };
  }
  if (kind === "recovery")
    return {
      domain: "recovery",
      value: {
        type: "recovery.track.create",
        track: {
          id,
          category: "custom",
          customCategory: String(data.get("category")).trim(),
          startDate: data.get("start"),
          visibility: "private",
        },
      },
    };
  if (kind === "checkin")
    return {
      domain: "recovery",
      value: {
        type: "recovery.checkin",
        trackId: id,
        dailyXpDate: state.date,
        mood: "neutral",
        trigger: "",
        note: String(data.get("note")),
      },
    };
  throw new Error("Unsupported editor");
}
