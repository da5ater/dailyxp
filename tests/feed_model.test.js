const test=require("node:test"); const assert=require("node:assert/strict"); const Feed=require("../FeedModel.js");
test("sound respects quiet hours, category, master, reducedMotion",()=>{
  const settings={ masterVolume:1, categoryVolumes:{ xp:1 }, quietHours:{start:22,end:7}, reducedMotion:false };
  assert.equal(Feed.shouldPlay(settings,{category:"xp"},10),true);
  assert.equal(Feed.shouldPlay(settings,{category:"xp"},23),false);
  assert.equal(Feed.shouldPlay({masterVolume:0},{category:"xp"},10),false);
  assert.equal(Feed.shouldPlay({masterVolume:1,categoryVolumes:{xp:0}},{category:"xp"},10),false);
  assert.equal(Feed.shouldPlay({masterVolume:1,reducedMotion:true},{category:"xp",needsMotion:true},10),false);
});
test("notification budget: one upcoming/ending, bundled rank, rate-limited",()=>{
  const events=[{type:"reminder.upcoming"},{type:"reminder.upcoming"},{type:"reminder.ending"},{type:"reminder.ending"},{type:"achievement"},{type:"rank_change"},{type:"rank_change"},{type:"rank_change"}];
  const budgeted=Feed.notificationBudget(events);
  assert.equal(budgeted.filter(e=>e.type==="reminder.upcoming").length,1);
  assert.equal(budgeted.filter(e=>e.type==="reminder.ending").length,1);
  assert.equal(budgeted.filter(e=>e.type==="rank_change").length,1);
  assert.equal(budgeted.find(e=>e.type==="rank_change").bundled,true);
});
test("no punitive relapse or guilt notification",()=>{
  const events=[{type:"relapse"},{type:"missed_work"},{type:"achievement"}];
  const budgeted=Feed.notificationBudget(events);
  assert.ok(!budgeted.some(e=>e.type==="relapse"));
  assert.ok(budgeted.some(e=>e.type==="achievement"));
});
