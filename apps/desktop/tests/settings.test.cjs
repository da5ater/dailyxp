const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { Core, atomicWrite } = require("../core/core.cjs");
const Event = require("../../../EventModel.js");
const State = require("../../../StateModel.js");
const Settings = require("../../../SettingsModel.js");
function fixture(t, options) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dailyxp-settings-"));
  const core = new Core(directory, options);
  t.after(() => {
    core.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return core;
}
test("settings replay from canonical journal and export detects corruption", (t) => {
  const c = fixture(t);
  c.settings({
    dayBoundaryMinutes: 360,
    dailyTargetMinutes: 90,
    reducedMotion: true,
  });
  c.execute("habit", {
    type: "habit.create",
    habit: {
      id: "h",
      title: "Read",
      startDate: c.dateAt(),
      schedule: { type: "daily" },
    },
  });
  c.execute("habit", {
    type: "habit.complete",
    habitId: "h",
    dailyXpDate: c.dateAt(),
  });
  const raw = c.exportJournal();
  const loaded = Event.loadJournal(raw);
  assert.equal(loaded.ok, true);
  assert.deepEqual(
    Settings.project(loaded.journal.events),
    c.snapshot().settings,
  );
  const other = fixture(t);
  other.importLegacy(raw);
  assert.deepEqual(other.snapshot().settings, c.snapshot().settings);
  assert.deepEqual(other.snapshot().progression, c.snapshot().progression);
  assert.deepEqual(other.snapshot().habit, c.snapshot().habit);
  const corrupted = JSON.parse(raw);
  corrupted.events.find(
    (e) => e.type === "settings.changed",
  ).payload.settings.dayBoundaryMinutes = 12;
  assert.equal(
    Event.loadJournal(JSON.stringify(corrupted)).code,
    "invalid_checksum",
  );
  c.close();
  const replay = new Core(c.directory);
  try {
    assert.deepEqual(replay.snapshot().settings, other.snapshot().settings);
  } finally {
    replay.close();
  }
});
test("settings edits reject invalid input and failed writes preserve disk and live values", (t) => {
  const c = fixture(t);
  const raw = c.exportJournal(),
    before = c.snapshot().settings;
  for (const changes of [
    null,
    [],
    { wrong: 1 },
    { dayBoundaryMinutes: -1 },
    { dayBoundaryMinutes: 1440 },
    { reducedMotion: "yes" },
    { dailyTargetMinutes: 0 },
  ])
    assert.throws(() => c.settings(changes));
  c.write = () => {
    throw new Error("Disk full");
  };
  assert.throws(() => c.settings({ reducedMotion: true }), /Disk full/);
  assert.deepEqual(c.snapshot().settings, before);
  assert.equal(c.exportJournal(), raw);
  c.write = atomicWrite;
  c.settings({ reducedMotion: true });
  const count = c.journal.events.length;
  c.settings({ reducedMotion: true });
  assert.equal(c.journal.events.length, count);
});
test("existing desktop settings migrate once and future replay ignores the cache", (t) => {
  const c = fixture(t);
  const journal = {
    ...c.journal,
    events: c.journal.events.filter((e) => e.type !== "settings.changed"),
  };
  const settings = {
    ...Settings.DEFAULTS,
    reducedMotion: true,
    dayBoundaryMinutes: 420,
  };
  const data = {
    ...c.data,
    envelope: State.withEventJournal(
      c.data.envelope,
      Event.exportJournal(journal),
    ),
    settings,
  };
  const crypto = require("node:crypto");
  data.checksum = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        envelope: data.envelope,
        settings,
        receipts: data.receipts,
      }),
    )
    .digest("hex");
  c.close();
  fs.writeFileSync(
    path.join(c.directory, "desktop.json"),
    JSON.stringify(data),
  );
  const replay = new Core(c.directory);
  assert.deepEqual(replay.snapshot().settings, settings);
  assert.equal(
    replay.journal.events.filter((e) => e.type === "settings.changed").length,
    1,
  );
  replay.close();
  const again = new Core(c.directory);
  try {
    assert.deepEqual(again.snapshot().settings, settings);
  } finally {
    again.close();
  }
});
test("reset needs explicit confirmation and returns persisted fresh progress", (t) => {
  const c = fixture(t);
  c.settings({ reducedMotion: true });
  c.execute("session", {
    type: "session.start",
    session: { primarySkill: "focus", plannedMinutes: 25 },
  });
  assert.throws(() => c.reset(), /confirmation/);
  c.reset("reset-profile");
  assert.equal(c.snapshot().session.activeSession, null);
  assert.deepEqual(c.snapshot().settings, Settings.DEFAULTS);
  assert.equal(c.status().lifetimeXp, 0);
  assert.equal(
    c.data.receipts.some((r) => r.result?.confirmation),
    false,
  );
  c.close();
  const replay = new Core(c.directory);
  try {
    assert.equal(replay.status().session, null);
    assert.deepEqual(replay.snapshot().settings, Settings.DEFAULTS);
  } finally {
    replay.close();
  }
});
test("day boundary applies to dated occurrences and finished Session slicing after restart", (t) => {
  let now = new Date(2026, 9, 21, 3, 30);
  const c = fixture(t, { clock: () => now });
  c.settings({ dayBoundaryMinutes: 300 });
  c.execute("planning", {
    type: "routine.create",
    routine: {
      id: "r",
      title: "Read",
      primarySkill: "reading",
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7] },
      startDate: c.dateAt(),
      expectedMinutes: 10,
      carryover: false,
      restDates: [],
    },
  });
  c.close();
  const replay = new Core(c.directory, { clock: () => now });
  try {
    assert.equal(replay.dateAt(), "2026-10-20");
    assert.ok(
      replay
        .snapshot()
        .planning.occurrences.some((o) => o.dailyXpDate === "2026-10-20"),
    );
    replay.execute("session", {
      type: "session.start",
      session: { primarySkill: "reading" },
    });
    now = new Date(2026, 9, 21, 5, 30);
    replay.execute("session", { type: "session.finish" });
    const session = replay.snapshot().session.sessions[0];
    assert.equal(session.sliceContext.dayBoundaryMinutes, 300);
    assert.equal(session.dailySlices.length, 2);
    assert.equal(session.dailySlices[0].dailyXpDate, "2026-10-20");
    assert.equal(session.dailySlices[1].dailyXpDate, "2026-10-21");
  } finally {
    replay.close();
  }
});
test("invalid settings import preserves disk, live state and restart", (t) => {
  const c = fixture(t);
  const before = fs.readFileSync(
    path.join(c.directory, "desktop.json"),
    "utf8",
  );
  const malformed = structuredClone(c.journal);
  malformed.events.find(
    (e) => e.type === "settings.changed",
  ).payload.settings.reducedMotion = "bad";
  const raw = Event.exportCheckedJournal(malformed);
  assert.equal(Event.loadJournal(raw).ok, true);
  assert.throws(() => c.importLegacy(raw), /Invalid settings/);
  assert.equal(
    fs.readFileSync(path.join(c.directory, "desktop.json"), "utf8"),
    before,
  );
  assert.deepEqual(c.snapshot().settings, Settings.DEFAULTS);
  c.close();
  const replay = new Core(c.directory);
  try {
    assert.deepEqual(replay.snapshot().settings, Settings.DEFAULTS);
  } finally {
    replay.close();
  }
});
test("atomic export replaces a permissive file with a private complete journal", (t) => {
  const c = fixture(t);
  const file = path.join(c.directory, "export.json");
  fs.writeFileSync(file, "old", { mode: 0o644 });
  atomicWrite(file, c.exportJournal());
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(Event.loadJournal(fs.readFileSync(file, "utf8")).ok, true);
});
