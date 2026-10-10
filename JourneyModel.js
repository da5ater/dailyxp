function levelProgress(progression) {
  var consumed = 0;
  for (var level = 1; level < progression.level; level++) consumed += 500 + 50 * (level - 1);
  return { have: Math.max(0, progression.totals.lifetimeXp - consumed), need: 500 + 50 * (progression.level - 1) };
}

function ledgerEntries(progression, events) {
  var sources = Object.create(null);
  events.forEach(function(event) {
    sources[event.eventId] = event;
    if (event.type === "progression.correction") sources[event.payload.id] = event;
  });
  return progression.ledger.map(function(award) {
    var source = sources[award.sourceEventId];
    return { id: award.id, amount: award.lifetimeXp, ruleVersion: award.ruleVersion,
      reason: award.reason, timestamp: source ? source.occurredAtUtc : null,
      dailyXpDate: award.dailyXpDate || (source ? source.dailyXpDate : null), sourceEventId: award.sourceEventId };
  });
}

function view(progression, sessions, habits, events, today) {
  var ledger = ledgerEntries(progression, events);
  var day = new Date(today + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  var start = day.toISOString().slice(0, 10);
  function thisWeek(date) { return date >= start && date <= today; }
  var focused = 0;
  sessions.forEach(function(session) {
    if (session.status !== "finished") return;
    var slices = session.dailySlices || [{ dailyXpDate: session.dailyXpDate, milliseconds: session.focusedMilliseconds }];
    slices.forEach(function(slice) { if (thisWeek(slice.dailyXpDate)) focused += slice.milliseconds; });
  });
  var streaks = (habits.habits || []).map(function(habit) {
    var streak = (habits.streaks || {})[habit.id];
    return { title: habit.title, current: streak ? streak.current : 0 };
  });
  return { level: progression.level, storyRank: progression.storyRank, momentum: progression.momentum,
    lifetimeXp: progression.totals.lifetimeXp, progress: levelProgress(progression), ledger: ledger,
    weeklyFocusedMinutes: Math.floor(focused / 60000), currentStreaks: streaks,
    weeklyXp: ledger.reduce(function(total, award) { return total + (thisWeek(award.dailyXpDate) ? award.amount : 0); }, 0) };
}

if (typeof module !== "undefined" && module.exports) module.exports = { levelProgress: levelProgress, ledgerEntries: ledgerEntries, view: view };
