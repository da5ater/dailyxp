const test = require("node:test");
const assert = require("node:assert/strict");

const PlanningModel = require("../PlanningModel.js");

function apply(projection, command) {
  const result = PlanningModel.decide(projection, command);
  return PlanningModel.projectIntents(projection, result.events);
}

test("creates the Goal hierarchy while allowing a standalone Task", () => {
  let plan = PlanningModel.emptyProjection();
  plan = apply(plan, {
    type: "goal.create",
    goal: { id: "goal-job", title: "Land a backend job", status: "active", targetDate: null,
      primarySkill: "backend/build", reason: "Start my career" }
  });
  plan = apply(plan, {
    type: "milestone.create",
    milestone: { id: "milestone-course", goalId: "goal-job", title: "Finish Boot.dev",
      measurement: { type: "binary" }, significance: 4 }
  });
  plan = apply(plan, {
    type: "task.create",
    task: { id: "task-anki", title: "Review Anki", estimateMinutes: 60, urgency: "normal",
      deadline: null, primarySkill: "backend/study", goalId: null, milestoneId: null }
  });

  assert.equal(plan.goals[0].title, "Land a backend job");
  assert.equal(plan.milestones[0].goalId, "goal-job");
  assert.equal(plan.milestones[0].measurement.type, "binary");
  assert.equal(plan.tasks[0].goalId, null);
  assert.equal(plan.tasks[0].status, "open");
  assert.equal(Object.isFrozen(plan), true);
});

test("advancing a day creates one scheduled occurrence and carries unfinished work as overdue", () => {
  let plan = PlanningModel.emptyProjection();
  plan = apply(plan, {
    type: "routine.create",
    routine: { id: "routine-bootdev", title: "Study Boot.dev", expectedMinutes: 240,
      startDate: "2026-08-17", endDate: null, restDates: [], carryover: true,
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
      primarySkill: "backend/study", goalId: null, milestoneId: null }
  });

  plan = apply(plan, { type: "day.advance", dailyXpDate: "2026-08-20" });
  plan = apply(plan, { type: "day.advance", dailyXpDate: "2026-08-20" });
  assert.deepEqual(plan.occurrences.map(item => [item.dailyXpDate, item.status]), [["2026-08-20", "open"]]);

  plan = apply(plan, { type: "day.advance", dailyXpDate: "2026-08-21" });
  assert.deepEqual(plan.occurrences.map(item => [item.dailyXpDate, item.status]), [
    ["2026-08-20", "overdue"],
    ["2026-08-21", "open"]
  ]);
  assert.notEqual(plan.occurrences[0].occurrenceKey, plan.occurrences[1].occurrenceKey);
});

test("Routine edit scopes preserve completed history and change only targeted untouched occurrences", () => {
  let plan = PlanningModel.emptyProjection();
  plan = apply(plan, {
    type: "routine.create",
    routine: { id: "routine-anki", title: "Review Anki", expectedMinutes: 60,
      startDate: "2026-08-20", endDate: null, restDates: [], carryover: false,
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7] },
      primarySkill: "backend/study", goalId: null, milestoneId: null }
  });
  plan = apply(plan, { type: "day.advance", dailyXpDate: "2026-08-20" });
  plan = apply(plan, { type: "occurrence.transition", id: plan.occurrences[0].id, status: "completed" });
  plan = apply(plan, { type: "day.advance", dailyXpDate: "2026-08-21" });
  plan = apply(plan, {
    type: "routine.edit", id: "routine-anki", scope: "today_and_future", dailyXpDate: "2026-08-21",
    changes: { title: "Review difficult Anki cards", expectedMinutes: 45 }
  });

  assert.deepEqual(plan.occurrences.map(item => [item.dailyXpDate, item.title, item.expectedMinutes, item.status]), [
    ["2026-08-20", "Review Anki", 60, "completed"],
    ["2026-08-21", "Review difficult Anki cards", 45, "open"]
  ]);
  assert.equal(plan.routines[0].revision, 2);
  assert.equal(plan.routines[0].expectedMinutes, 45);
});

test("templates and adaptive suggestions change commitments only after explicit acceptance", () => {
  const proposal = {
    id: "template-study",
    kind: "template",
    explanation: "A small study journey",
    commands: [
      { type: "goal.create", goal: { id: "goal-course", title: "Finish the course", status: "active",
        targetDate: null, primarySkill: "backend/study", reason: "Build foundations" } },
      { type: "routine.create", routine: { id: "routine-study", title: "Study", expectedMinutes: 60,
        startDate: "2026-08-21", endDate: null, restDates: [], carryover: true,
        schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5] },
        primarySkill: "backend/study", goalId: "goal-course", milestoneId: null } }
    ]
  };
  const empty = PlanningModel.emptyProjection();
  const previewed = PlanningModel.decide(empty, { type: "proposal.preview", proposal });
  const edited = PlanningModel.decide(empty, {
    type: "proposal.edit", proposal, changes: { explanation: "Start with one focused hour" }
  });
  const dismissed = apply(empty, { type: "proposal.dismiss", proposalId: proposal.id,
    kind: "adaptive", dismissedUntil: "2026-09-21" });

  assert.equal(previewed.events.length, 0);
  assert.equal(edited.events.length, 0);
  assert.equal(edited.preview.explanation, "Start with one focused hour");
  assert.equal(dismissed.goals.length, 0);
  assert.equal(dismissed.suggestions[0].status, "dismissed");

  const accepted = PlanningModel.decide(empty, { type: "proposal.accept", proposal });
  const plan = PlanningModel.projectIntents(empty, accepted.events);
  assert.equal(plan.goals.length, 1);
  assert.equal(plan.routines.length, 1);
  assert.equal(plan.suggestions[0].status, "accepted");
});

test("lifecycle commands delete only unstarted records and archive durable history", () => {
  let plan = PlanningModel.emptyProjection();
  plan = apply(plan, { type: "task.create", task: { id: "task-delete", title: "Draft notes",
    estimateMinutes: 30, urgency: "normal", deadline: null, primarySkill: "writing",
    goalId: null, milestoneId: null } });
  plan = apply(plan, { type: "entity.remove", entityType: "task", id: "task-delete" });
  assert.equal(plan.tasks.length, 0);

  plan = apply(plan, { type: "task.create", task: { id: "task-durable", title: "Build plugin",
    estimateMinutes: 120, urgency: "urgent", deadline: null, primarySkill: "backend/build",
    goalId: null, milestoneId: null } });
  plan = apply(plan, { type: "task.transition", id: "task-durable", status: "completed" });
  plan = apply(plan, { type: "entity.remove", entityType: "task", id: "task-durable" });
  assert.equal(plan.tasks[0].status, "archived");
});

test("custom frequency and rest dates use frozen DailyXP dates without duplicate occurrences", () => {
  let plan = PlanningModel.emptyProjection();
  plan = apply(plan, { type: "routine.create", routine: { id: "routine-build", title: "Build",
    expectedMinutes: 120, startDate: "2026-03-27", endDate: "2026-04-03",
    restDates: ["2026-03-29"], carryover: false,
    schedule: { type: "interval", everyDays: 2, anchorDate: "2026-03-27" },
    primarySkill: "backend/build", goalId: null, milestoneId: null } });

  for (const dailyXpDate of ["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-31", "2026-04-02"])
    plan = apply(plan, { type: "day.advance", dailyXpDate });

  assert.deepEqual(plan.occurrences.map(item => item.dailyXpDate), ["2026-03-27", "2026-03-31", "2026-04-02"]);
  assert.deepEqual(plan.occurrences.map(item => item.occurrenceKey), [
    "routine:routine-build:day:2026-03-27",
    "routine:routine-build:day:2026-03-31",
    "routine:routine-build:day:2026-04-02"
  ]);
});

test("Milestone progress locks significance and preserves its measurement contract", () => {
  let plan = PlanningModel.emptyProjection();
  plan = apply(plan, { type: "goal.create", goal: { id: "goal-problems", title: "Solve 550 problems",
    status: "active", targetDate: null, primarySkill: "backend/study", reason: "Interview readiness" } });
  plan = apply(plan, { type: "milestone.create", milestone: { id: "milestone-100", goalId: "goal-problems",
    title: "Solve 100", measurement: { type: "numeric", target: 100, unit: "problems" }, significance: 3 } });
  plan = apply(plan, { type: "milestone.progress", id: "milestone-100", value: 12 });

  assert.equal(plan.milestones[0].progress, 12);
  assert.equal(plan.milestones[0].lockedSignificance, 3);
  assert.throws(() => PlanningModel.decide(plan, {
    type: "milestone.edit", id: "milestone-100", changes: { significance: 5 }
  }), /significance/);
});
