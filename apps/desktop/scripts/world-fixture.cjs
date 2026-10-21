const { Core } = require("../core/core.cjs");

// Reaches the seven-day condition with production commands and an owned clock.
// The normal verifier independently proves entry from an empty profile via UI.
function prepareWorld(directory, today = new Date()) {
  let now = new Date(today);
  now.setHours(12, 0, 0, 0);
  now.setDate(now.getDate() - 8);
  const core = new Core(directory, { clock: () => now });
  try {
    core.execute("planning", {
      type: "goal.create",
      goal: {
        id: "return-province",
        title: "Build a small game",
        reason: "Make something worth playing",
        primarySkill: "creative/build",
      },
    });
    core.execute("planning", {
      type: "goal.create",
      goal: {
        id: "reclaimed-province",
        title: "Learn the basics",
        reason: "Lay the foundations",
        primarySkill: "creative/build",
      },
    });
    core.execute("planning", {
      type: "goal.transition",
      id: "reclaimed-province",
      status: "achieved",
    });
    for (const [id, title] of [
      ["built", "Sketch the world"],
      ["planned", "Make the first level playable"],
    ])
      core.execute("planning", {
        type: "milestone.create",
        milestone: {
          id,
          title,
          goalId: "return-province",
          measurement: { type: "binary" },
          significance: 1,
        },
      });
    core.execute("planning", {
      type: "milestone.progress",
      id: "built",
      value: true,
    });
    core.execute("habit", {
      type: "habit.create",
      habit: {
        id: "small-step",
        title: "One small creative step",
        startDate: core.dateAt(),
        schedule: { type: "daily" },
        restDates: [],
      },
    });
    for (let day = 0; day < 8; day++) {
      now.setDate(now.getDate() + 1);
      core.advanceDay();
    }
    return core.snapshot();
  } finally {
    core.close();
  }
}
module.exports = { prepareWorld };
if (require.main === module)
  console.log(JSON.stringify(prepareWorld(process.argv[2]).story, null, 2));
