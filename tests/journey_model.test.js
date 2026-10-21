const test = require('node:test');
const assert = require('node:assert/strict');
const Journey = require('../JourneyModel.js');
const Progression = require('../ProgressionModel.js');

function award(id, minutes, date) {
  return { type: 'session.finished', eventId: id, occurredAtUtc: date + 'T12:00:00Z',
    dailyXpDate: date, payload: { focusedMilliseconds: minutes * 60000, plannedMinutes: null } };
}

test('earned session XP renders next-level remainder and exact ledger source metadata', () => {
  const events = [award('a', 499, '2026-10-10'), award('b', 50, '2026-10-10')];
  const projection = Progression.project(events);
  const view = Journey.view(projection, [], {}, events, '2026-10-10');
  assert.equal(view.level, projection.level);
  assert.equal(view.progress.have, projection.totals.lifetimeXp - 500);
  assert.equal(view.progress.need, 550);
  assert.equal(view.ledger.length, 2);
  assert.equal(view.ledger[1].amount, 50);
  assert.equal(view.ledger[1].timestamp, '2026-10-10T12:00:00Z');
  assert.equal(view.ledger[1].ruleVersion, Progression.RULE_VERSION);
  assert.deepEqual(Journey.view(Progression.project(JSON.parse(JSON.stringify(events))), [], {}, events, '2026-10-10'), view);
});

test('weekly insights use Monday boundary, completed daily slices and current habit streaks', () => {
  const events = [award('old', 15, '2026-10-04'), award('new', 30, '2026-10-05'), award('future', 10, '2026-10-11')];
  const sessions = [
    { status:'finished', dailySlices:[{dailyXpDate:'2026-10-04',milliseconds:60000},{dailyXpDate:'2026-10-05',milliseconds:120000}] },
    { status:'running', focusedMilliseconds:100000, dailyXpDate:'2026-10-10' }
  ];
  const view = Journey.view(Progression.project(events), sessions,
    {habits:[{id:'h',title:'Study'}],streaks:{h:{current:3,longest:99}}}, events, '2026-10-10');
  assert.equal(view.weeklyFocusedMinutes, 2);
  assert.equal(view.weeklyXp, 30);
  assert.deepEqual(view.currentStreaks, [{title:'Study',current:3}]);
});

test('empty progression has no fabricated awards and corrections resolve their journal timestamp', () => {
  const empty = Journey.view(Progression.emptyProjection(), [], {}, [], '2026-10-10');
  assert.equal(empty.level, 1);
  assert.equal(empty.lifetimeXp, 0);
  assert.deepEqual(empty.ledger, []);
  const events = [{eventId:'event-correction',type:'progression.correction',occurredAtUtc:'2026-10-10T14:00:00Z',
    dailyXpDate:'2026-10-10',payload:{id:'correction-id',reason:'Correction',lifetimeXp:10,seasonXp:0}}];
  assert.equal(Journey.view(Progression.project(events), [], {}, events, '2026-10-10').weeklyXp, 10);
  assert.equal(Journey.ledgerEntries(Progression.project(events), events)[0].timestamp, events[0].occurredAtUtc);
});

test('correction IDs cannot overwrite session provenance and duplicate corrections retain first source', () => {
  const session = award('session-id', 20, '2026-10-09');
  const first = {eventId:'correction-event',type:'progression.correction',dailyXpDate:'2026-10-10',
    occurredAtUtc:'2026-10-10T14:00:00Z',payload:{id:'session-id',lifetimeXp:10,reason:'Correction'}};
  const duplicate = {...first,eventId:'later-event',occurredAtUtc:'2026-10-11T14:00:00Z'};
  const events = [session,first,duplicate];
  const ledger = Journey.ledgerEntries(Progression.project(events), events);
  assert.equal(ledger[0].timestamp, session.occurredAtUtc);
  assert.equal(ledger[1].timestamp, first.occurredAtUtc);
});
