const test = require('node:test');
const assert = require('node:assert/strict');
const View = require('../RoutineView.js');
const Planning = require('../PlanningModel.js');
const Journal = require('../PlanningJournal.js');
const Event = require('../EventModel.js');

function draft(weekdays=[1,2,3,4,5,6,7]) { return {title:' Study Ruby ',minutes:'120',weekdays}; }

test('routine form rejects empty name, missing weekdays and invalid durations', () => {
  for (const minutes of ['0','-1','1.5','12x','1441',''])
    assert.throws(() => View.createRoutine({...draft(),minutes}, 'r', '2026-10-21'));
  assert.throws(() => View.createRoutine({...draft(),title:' '},'r','2026-10-21'));
  assert.throws(() => View.createRoutine(draft([]),'r','2026-10-21'));
  assert.equal(View.createRoutine(draft([3]),'r','2026-10-21').title, 'Study Ruby');
});

test('routine creation emits current occurrence, persists, advances and replays without duplicate keys', () => {
  let journal = Event.createJournal('11111111-1111-4111-8111-111111111111');
  function apply(command) {
    const result = Planning.decide(Planning.project(journal.events),command);
    journal = Journal.appendIntents(journal,result.events,{
      occurredAtUtc:'2026-10-21T12:00:00.000Z',localDateTime:'2026-10-21T15:00:00.000',timezone:'Africa/Cairo',
      utcOffsetMinutes:180,systemTimezoneVerified:true,dayBoundaryMinutes:240},Event);
  }
  apply({type:'day.advance',dailyXpDate:'2026-10-21'});
  apply({type:'routine.create',routine:View.createRoutine(draft(),'ruby-routine','2026-10-21')});
  let plan = Planning.project(journal.events);
  assert.equal(View.todayOccurrences(plan,'2026-10-21')[0].kind,'routine');
  assert.equal(plan.tasks.length,0);
  assert.equal(plan.occurrences[0].expectedMinutes,120);
  apply({type:'day.advance',dailyXpDate:'2026-10-22'});
  apply({type:'day.advance',dailyXpDate:'2026-10-22'});
  plan = Planning.project(journal.events);
  assert.equal(plan.occurrences.length,2);
  assert.equal(new Set(plan.occurrences.map(item=>item.occurrenceKey)).size,2);
  assert.equal(View.todayOccurrences(plan,'2026-10-22').length,1);
  assert.deepEqual(Planning.project(JSON.parse(JSON.stringify(journal.events))),plan);
});

test('weekday schedule excludes unscheduled days from the PLAY rail', () => {
  let plan=Planning.emptyProjection();
  for(const command of [{type:'day.advance',dailyXpDate:'2026-10-21'},
    {type:'routine.create',routine:View.createRoutine(draft([4]),'r','2026-10-21')}])
    plan=Planning.projectIntents(plan,Planning.decide(plan,command).events);
  assert.deepEqual(View.todayOccurrences(plan,'2026-10-21'),[]);
  assert.equal(View.scheduleLabel(plan.routines[0]),'THU');
});


test('stored interval routines retain a truthful schedule label', () => {
  assert.equal(View.scheduleLabel({schedule:{type:'interval',everyDays:2}}),'EVERY 2 DAYS');
});

test('routine form preserves the explicit carryover choice',()=>{
  assert.equal(View.createRoutine({...draft(),carryover:true},'r','2026-10-21').carryover,true);
  assert.equal(View.createRoutine(draft(),'r','2026-10-21').carryover,false);
});
