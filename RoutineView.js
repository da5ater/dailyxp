var WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function createRoutine(draft, id, today) {
  var title = draft.title.trim();
  if (!title) throw new Error("NAME IS REQUIRED");
  if (!/^\d+$/.test(draft.minutes) || Number(draft.minutes) < 1 || Number(draft.minutes) > 1440)
    throw new Error("MINUTES MUST BE 1–1440");
  var days = draft.weekdays.slice().sort(function(a, b) { return a - b; });
  if (!days.length) throw new Error("CHOOSE AT LEAST ONE WEEKDAY");
  return { id: id, title: title, expectedMinutes: Number(draft.minutes),
    startDate: today, endDate: null, restDates: [], carryover: draft.carryover === true,
    schedule: { type: "weekdays", weekdays: days }, primarySkill: "general/focus", goalId: null, milestoneId: null };
}

function scheduleLabel(routine) {
  if (routine.schedule.type === "interval")
    return "EVERY " + routine.schedule.everyDays + (routine.schedule.everyDays === 1 ? " DAY" : " DAYS");
  return routine.schedule.weekdays.map(function(day) { return WEEKDAYS[day - 1]; }).join(" · ");
}

function occurrenceTask(item) {
  return { id: item.id, occurrenceKey: item.occurrenceKey, title: item.title,
    primarySkill: item.primarySkill, estimateMinutes: item.expectedMinutes,
    goalId: item.goalId, kind: "routine" };
}

function todayOccurrences(plan, today) {
  return plan.occurrences.filter(function(item) { return item.dailyXpDate === today && item.status === "open"; })
    .map(occurrenceTask);
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { createRoutine: createRoutine, scheduleLabel: scheduleLabel,
    todayOccurrences: todayOccurrences, occurrenceTask: occurrenceTask };
