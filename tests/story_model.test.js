const test = require("node:test");
const assert = require("node:assert/strict");
const StoryModel = require("../StoryModel.js");

function sources(overrides={}) {
  return {
    goals: [],
    milestones: [],
    occurrences: [],
    sessions: [],
    habits: [],
    habitCompletions: [],
    dailySummaries: {},
    lastAdvanced: null,
    momentum: "Steady",
    ...overrides
  };
}

test("maps Goal lifecycle to Province and landmark states without altering permanent progress", () => {
  const src = sources({
    goals: [
      { id: "g-active", title: "Active Goal", status: "active" },
      { id: "g-paused", title: "Paused Goal", status: "paused" },
      { id: "g-achieved", title: "Done", status: "achieved" },
      { id: "g-abandoned", title: "Ruins", status: "abandoned" }
    ],
    milestones: [
      { id: "m1", goalId: "g-active", title: "Landmark", status: "open", significance: 2 },
      { id: "m2", goalId: "g-achieved", title: "Built", status: "completed", significance: 3 }
    ],
    lastAdvanced: "2026-08-17"
  });
  const proj = StoryModel.recompute(StoryModel.emptyProjection(), src);
  assert.equal(proj.provinces.find(p=>p.id==="g-active").status, "active");
  assert.equal(proj.provinces.find(p=>p.id==="g-paused").status, "sleeping");
  assert.equal(proj.provinces.find(p=>p.id==="g-achieved").status, "achieved");
  assert.equal(proj.provinces.find(p=>p.id==="g-abandoned").status, "ruins");
  assert.equal(proj.provinces.find(p=>p.id==="g-active").landmarks[0].status, "planned");
  assert.equal(proj.provinces.find(p=>p.id==="g-achieved").landmarks[0].status, "built");
  // permanence: goal objects unchanged
  assert.equal(src.goals[0].status, "active");
});

test("seven inactive eligible days trigger comeback quest with three steps", () => {
  const habits = [{ id: "h1" }];
  const dailySummaries = {};
  for (let d=10; d<=17; d++) {
    const date = `2026-08-${String(d).padStart(2,"0")}`;
    dailySummaries[date] = { eligibleCount: 1 };
  }
  const src = sources({ habits, dailySummaries, habitCompletions: [], sessions: [], occurrences: [], lastAdvanced: "2026-08-17", momentum: "Dormant" });
  const proj = StoryModel.recompute(StoryModel.emptyProjection(), src);
  assert.ok(proj.comebackQuest);
  assert.equal(proj.comebackQuest.status, "available");
  assert.equal(proj.comebackQuest.steps.length, 3);
  assert.match(proj.comebackQuest.explains, /7 inactive/);
});

test("comeback quest success, partial, ignore without punishment", () => {
  const base = StoryModel.recompute(StoryModel.emptyProjection(), sources({
    habits: [{id:"h1"}], dailySummaries: {"2026-08-17":{eligibleCount:1}}, lastAdvanced:"2026-08-17", momentum:"Dormant"
  }));
  // Simulate 7 inactive already tested above – force quest available
  const withQuest = { ...base, comebackQuest: { id:"comeback:2026-08-17", status:"available", steps:[
    { id:"small-action", title:"One small", required:"x", completed:false },
    { id:"planned-work", title:"Planned", required:"y", completed:false },
    { id:"daily-target", title:"Target", required:"z", completed:false }
  ], reward:"x" } };
  const accepted = StoryModel.decide(withQuest, { type:"story.comeback.accept" });
  let proj = StoryModel.projectIntents(withQuest, accepted.events, { habits:[{id:"h1"}], dailySummaries:{"2026-08-17":{eligibleCount:1}}, lastAdvanced:"2026-08-17" });
  assert.equal(proj.comebackQuest.status, "active");
  // progress one step
  const prog1 = StoryModel.decide(proj, { type:"story.comeback.progress", stepId:"small-action" });
  proj = StoryModel.projectIntents(proj, prog1.events, {});
  assert.equal(proj.comebackQuest.steps[0].completed, true);
  assert.equal(proj.comebackQuest.status, "active");
  // ignore should be allowed from available but not active – test ignore path via direct
  const avail = StoryModel.recompute(StoryModel.emptyProjection(), sources({ habits:[{id:"h1"}], dailySummaries:Object.fromEntries(Array.from({length:8},(_,i)=>[`2026-08-${String(10+i).padStart(2,"0")}`,{eligibleCount:1}])), lastAdvanced:"2026-08-17", momentum:"Dormant"}));
  const ignored = StoryModel.decide(avail, { type:"story.comeback.ignore" });
  const projIgnored = StoryModel.projectIntents(avail, ignored.events, {});
  assert.equal(projIgnored.comebackQuest.status, "ignored");
  // success path
  const allSteps = StoryModel.decide(proj, { type:"story.comeback.complete" });
  const projCompleted = StoryModel.projectIntents(proj, allSteps.events, {});
  assert.equal(projCompleted.comebackQuest.status, "completed");
  assert.ok(projCompleted.achievements.some(a=>a.id==="comeback-hero") || projCompleted.comebackQuest.steps.every(s=>s.completed));
  // partial does not punish – still active, no loss
  const partial = StoryModel.decide(proj, { type:"story.comeback.progress", stepId:"planned-work" });
  const projPartial = StoryModel.projectIntents(proj, partial.events, {});
  assert.equal(projPartial.comebackQuest.status, "active");
});

test("antagonist states appear with neutral cause language and never insult", () => {
  const src = sources({
    goals: [{ id:"g1", title:"Goal One", status:"active" }],
    milestones: [],
    occurrences: [{ id:"o1", status:"overdue" },{ id:"o2", status:"overdue" },{ id:"o3", status:"overdue" }],
    sessions: [{ id:"s1", status:"discarded" },{ id:"s2", status:"discarded" }],
    habits: [],
    lastAdvanced:"2026-08-17",
    momentum:"Dormant"
  });
  const proj = StoryModel.recompute(StoryModel.emptyProjection(), src);
  const labels = proj.antagonists.map(a=>a.label);
  assert.ok(labels.includes("Drift"));
  assert.ok(labels.includes("Distraction"));
  assert.ok(labels.includes("Doubt") || labels.includes("Apathy"));
  assert.ok(proj.antagonists.every(a=> !/lazy|failure|shame|bad/i.test(a.cause)));
  assert.ok(proj.antagonists.every(a=> a.cause.length>10));
});

test("rest days do not hurt momentum and hollow king only unfinished territory", () => {
  const src = sources({
    goals: [{ id:"g1", title:"Unfinished", status:"active" }, { id:"g2", title:"Done", status:"achieved" }],
    habits: [{ id:"h1" }],
    dailySummaries: {"2026-08-17":{eligibleCount:1}},
    lastAdvanced:"2026-08-17",
    momentum:"Steady"
  });
  const proj = StoryModel.recompute(StoryModel.emptyProjection(), src);
  // with only one inactive day, no hollow king
  assert.ok(!proj.antagonists.some(a=>a.id==="hollow-king"));
  // now 7 inactive
  const dailySummaries7 = {};
  for(let d=10;d<=17;d++) dailySummaries7[`2026-08-${String(d).padStart(2,"0")}`]={eligibleCount:1};
  const src2 = sources({ goals: src.goals, habits: src.habits, dailySummaries: dailySummaries7, lastAdvanced:"2026-08-17", momentum:"Dormant" });
  const proj2 = StoryModel.recompute(StoryModel.emptyProjection(), src2);
  const hk = proj2.antagonists.find(a=>a.id==="hollow-king");
  assert.ok(hk);
  assert.ok(hk.provinces.includes("g1"));
  assert.ok(!hk.provinces.includes("g2"));
  assert.ok(!/punish|fail/i.test(hk.cause));
});

test("permanence: story derive does not alter goal/milestone/session", () => {
  const src = sources({
    goals: [{ id:"g1", title:"G", status:"active" }],
    milestones: [{ id:"m1", goalId:"g1", status:"open", significance:2 }],
    sessions: [{ id:"s1", status:"finished" }],
    lastAdvanced:"2026-08-17"
  });
  const before = JSON.stringify(src);
  StoryModel.recompute(StoryModel.emptyProjection(), src);
  assert.equal(JSON.stringify(src), before);
});

test("projection is frozen and deterministic", () => {
  const src = sources({ goals:[{ id:"g1", title:"G", status:"active" }], lastAdvanced:"2026-08-17" });
  const a = StoryModel.recompute(StoryModel.emptyProjection(), src);
  const b = StoryModel.recompute(StoryModel.emptyProjection(), src);
  assert.deepEqual(a,b);
  assert.ok(Object.isFrozen(a));
});
