const test = require('node:test');
const assert = require('node:assert/strict');
const Habit = require('../HabitModel.js');
const Planning = require('../PlanningModel.js');
const View = require('../HabitView.js');
function apply(model, state, command) { return model.projectIntents(state, model.decide(state, command).events); }
function habits() {
  let state = Habit.emptyProjection();
  for (const id of ['read', 'walk']) state = apply(Habit, state, { type: 'habit.create', habit: {
    id, title: id, startDate: '2026-10-20', schedule: { type: 'daily' }, restDates: []
  } });
  return apply(Habit, state, { type: 'habit.day.advance', dailyXpDate: '2026-10-21' });
}
test('today habit completion and skip are mutually exclusive, durable and idempotent', () => {
  let state = habits();
  state = apply(Habit, state, { type: 'habit.complete', habitId: 'read', dailyXpDate: '2026-10-21' });
  state = apply(Habit, state, { type: 'habit.skip', habitId: 'walk', dailyXpDate: '2026-10-21' });
  assert.deepEqual(View.todayHabits(state, '2026-10-21', Habit).map(h => h.state), ['done', 'skipped']);
  for (const type of ['habit.complete', 'habit.skip']) {
    assert.deepEqual(Habit.decide(state, { type, habitId: 'walk', dailyXpDate: '2026-10-21' }).events, []);
    assert.deepEqual(Habit.decide(state, { type, habitId: 'read', dailyXpDate: '2026-10-21' }).events, []);
  }
  assert.equal(state.dailySummaries['2026-10-21'].completedCount, 1);
  state = apply(Habit, state, { type: 'habit.day.advance', dailyXpDate: '2026-10-22' });
  assert.deepEqual(View.todayHabits(state, '2026-10-22', Habit).map(h => h.state), ['open', 'open']);
  assert.equal(View.todayHabits(state, '', Habit).length, 0);
  const events = Habit.decide(habits(), { type: 'habit.skip', habitId: 'walk', dailyXpDate: '2026-10-21' }).events;
  assert.equal(events[0].type, 'habit.skipped');
  assert.equal(Habit.project(events).skips.length, 1);
});
function plan() {
  return { ...Planning.emptyProjection(), lastAdvancedDailyXpDate: '2026-10-21', occurrences: [
    { id: 'long', title: 'Long', status: 'overdue', expectedMinutes: 30, dailyXpDate: '2026-10-19', occurrenceKey: 'long' },
    { id: 'small', title: 'Small', status: 'overdue', expectedMinutes: 10, dailyXpDate: '2026-10-20', occurrenceKey: 'small' }
  ] };
}
for (const action of ['smaller', 'reschedule', 'skip']) test(`${action} resolves one overdue item and suppresses the daily strip across replay`, () => {
  const before = plan();
  assert.equal(View.gentleSuggestion(before).id, 'small');
  const command = { type: 'overdue.disposition', id: 'small', action, dailyXpDate: '2026-10-21' };
  const events = Planning.decide(before, command).events;
  const after = Planning.projectIntents(before, events);
  assert.equal(View.gentleSuggestion(after), null);
  assert.deepEqual(Planning.decide(after, command).events, []);
  assert.equal(after.occurrences.find(o => o.id === 'long').status, 'overdue');
  assert.equal(after.occurrences.find(o => o.id === 'small').status, action === 'skip' ? 'skipped' : 'rescheduled');
  if (action !== 'skip') {
    const replacement = after.occurrences.find(o => o.rescheduledFrom === 'small');
    assert.equal(replacement.dailyXpDate, action === 'smaller' ? '2026-10-21' : '2026-10-22');
    assert.equal(replacement.expectedMinutes, action === 'smaller' ? 5 : 10);
  }
  assert.deepEqual(Planning.projectIntents(after, events), after);
  assert.equal(View.gentleSuggestion({ ...after, lastAdvancedDailyXpDate: '2026-10-22' }).id, 'long');
  assert.throws(() => Planning.decide(before, { ...command, dailyXpDate: '2026-10-20' }), /current planning day/);
  assert.throws(() => Planning.decide(before, { ...command, action: 'unknown' }), /unsupported/);
});
