function todayHabits(projection, today, habitModel) {
  if (!today) return [];
  return projection.habits.filter(function(habit) { return habitModel.scheduledOn(habit, today); })
    .map(function(habit) {
      var state = "open";
      if (habitModel.hasCompletion(projection.completions, habit.id, today)) state = "done";
      else if (habitModel.hasCompletion(projection.skips || [], habit.id, today)) state = "skipped";
      return { id: habit.id, title: habit.title, state: state,
        streak: projection.streaks[habit.id] ? projection.streaks[habit.id].current : 0 };
    });
}

function gentleSuggestion(plan) {
  if (!plan.lastAdvancedDailyXpDate || plan.lastGentleDispositionDate === plan.lastAdvancedDailyXpDate) return null;
  var overdue = plan.occurrences.filter(function(item) { return item.status === "overdue"; });
  overdue.sort(function(a, b) {
    return a.expectedMinutes - b.expectedMinutes || a.dailyXpDate.localeCompare(b.dailyXpDate) || a.id.localeCompare(b.id);
  });
  return overdue.length ? overdue[0] : null;
}

if (typeof module !== "undefined" && module.exports)
  module.exports = { todayHabits: todayHabits, gentleSuggestion: gentleSuggestion };
