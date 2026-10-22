const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const EventEmitter = require("node:events");
const Event = require("../../../EventModel.js");
const State = require("../../../StateModel.js");
const Journal = require("../../../PlanningJournal.js");
const models = Object.fromEntries(
  [
    "Planning",
    "Session",
    "Habit",
    "Progression",
    "Recovery",
    "Story",
    "Ux",
    "Insight",
    "Share",
    "Settings",
    "DayBlock",
  ].map((name) => [name.toLowerCase(), require(`../../../${name}Model.js`)]),
);

function atomicWrite(file, value) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, value);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
    const dir = fs.openSync(path.dirname(file), "r");
    try {
      fs.fsyncSync(dir);
    } finally {
      fs.closeSync(dir);
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
function fingerprint(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}
function validateDocument(raw) {
  const data = JSON.parse(raw);
  if (
    data.version !== 1 ||
    !data.envelope ||
    !State.decode(State.encode(data.envelope)).valid ||
    !data.settings ||
    !Array.isArray(data.receipts) ||
    data.checksum !==
      fingerprint({
        envelope: data.envelope,
        settings: data.settings,
        receipts: data.receipts,
      })
  ) {
    throw new Error(
      "Desktop state failed validation. Original files are unchanged.",
    );
  }
  const journal = Event.loadJournal(data.envelope.payload.eventJournalRaw);
  if (!journal.ok) throw new Error(journal.message);
  projectJournal(journal.journal);
  return data;
}
function serialize(data) {
  return (
    JSON.stringify({
      ...data,
      checksum: fingerprint({
        envelope: data.envelope,
        settings: data.settings,
        receipts: data.receipts,
      }),
    }) + "\n"
  );
}

function projectJournal(journal) {
  const settings = models.settings.project(journal.events);
  const projections = {};
  for (const name of [
    "planning",
    "session",
    "habit",
    "progression",
    "recovery",
    "ux",
    "insight",
    "share",
    "dayblock",
  ])
    projections[name] = models[name].project(journal.events);
  const p = projections;
  p.story = models.story.project(journal.events, {
    goals: p.planning.goals,
    tasks: p.planning.tasks,
    momentumActivity: p.progression._dailyActivity,
    milestones: p.planning.milestones,
    occurrences: p.planning.occurrences,
    sessions: p.session.sessions,
    habits: p.habit.habits,
    habitCompletions: p.habit.completions,
    dailySummaries: p.habit.dailySummaries,
    lastAdvanced: p.habit.lastAdvancedDailyXpDate,
    momentum: p.progression.momentum,
  });
  return { settings, projections };
}

class Core extends EventEmitter {
  constructor(
    directory,
    { clock = () => new Date(), write = atomicWrite } = {},
  ) {
    super();
    this.directory = path.resolve(directory);
    this.clock = clock;
    this.write = write;
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    this.lock = path.join(this.directory, "writer.lock");
    this.lockFd = fs.openSync(this.lock, "a+", 0o600);
    const lease = spawnSync("flock", ["-n", "3"], {
      stdio: ["ignore", "ignore", "pipe", this.lockFd],
    });
    if (lease.status !== 0) {
      fs.closeSync(this.lockFd);
      if (lease.error)
        throw new Error("DailyXP needs the util-linux flock command on Linux.");
      throw new Error(
        "This profile already has a writer. Open the existing application.",
      );
    }
    fs.ftruncateSync(this.lockFd, 0);
    fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid }));
    this.ownsLock = true;
    try {
      const raw = read(path.join(this.directory, "desktop.json"));
      const backupRaw = read(path.join(this.directory, "desktop.backup.json"));
      if (raw || backupRaw) {
        try {
          this.data = validateDocument(raw || backupRaw);
          if (!raw) this.recovered = true;
        } catch (error) {
          const backup = read(path.join(this.directory, "desktop.backup.json"));
          if (!backup) throw error;
          this.data = validateDocument(backup);
          this.recovered = true;
        }
      } else {
        const journal = Event.createJournal(crypto.randomUUID());
        this.data = {
          version: 1,
          envelope: State.withEventJournal(
            State.createEnvelope(State.emptyPayload(), 0),
            Event.exportJournal(journal),
          ),
          settings: {
            dayBoundaryMinutes: 240,
            dailyTargetMinutes: 120,
            reducedMotion: false,
            notifications: false,
          },
          receipts: [],
        };
        this.commit(this.data);
      }
      const legacySettings = this.data.settings;
      this.reproject();
      if (!this.journal.events.some((e) => e.type === "settings.changed")) {
        const settings = models.settings.validate(legacySettings);
        const journal = Journal.appendIntents(
          this.journal,
          [{ type: "settings.changed", payload: { settings } }],
          this.context(),
          Event,
        );
        this.commit({
          ...this.data,
          settings,
          envelope: State.withEventJournal(
            this.data.envelope,
            Event.exportJournal(journal),
          ),
        });
        this.reproject();
      }
      this.advanceDay();
    } catch (error) {
      this.close();
      throw error;
    }
  }
  close() {
    if (this.ownsLock) {
      fs.closeSync(this.lockFd);
      this.ownsLock = false;
    }
  }
  commit(next) {
    const primary = path.join(this.directory, "desktop.json");
    if (this.data && fs.existsSync(primary) && !this.recovered)
      this.write(
        path.join(this.directory, "desktop.backup.json"),
        serialize(this.data),
      );
    this.write(primary, serialize(next));
    this.data = next;
    this.recovered = false;
  }
  reproject() {
    const loaded = Event.loadJournal(
      this.data.envelope.payload.eventJournalRaw,
    );
    if (!loaded.ok) throw new Error(loaded.message);
    const projected = projectJournal(loaded.journal);
    this.journal = loaded.journal;
    this.data.settings = projected.settings;
    this.projections = projected.projections;
  }

  context(at = this.clock()) {
    const timezone = Event.systemTimezone();
    const local = Event.localSystemContext(at, timezone);
    return {
      occurredAtUtc: at.toISOString(),
      ...local,
      systemTimezoneVerified: true,
      dayBoundaryMinutes: this.data.settings.dayBoundaryMinutes,
    };
  }
  dateAt(at = this.clock()) {
    return Event.dailyXpDate(
      this.context(at).localDateTime,
      this.data.settings.dayBoundaryMinutes,
    );
  }
  advanceDay() {
    const date = this.dateAt();
    if (
      !this.projections.planning.lastAdvancedDailyXpDate ||
      this.projections.planning.lastAdvancedDailyXpDate < date
    )
      this.execute("planning", { type: "day.advance", dailyXpDate: date });
    if (
      !this.projections.habit.lastAdvancedDailyXpDate ||
      this.projections.habit.lastAdvancedDailyXpDate < date
    )
      this.execute("habit", { type: "habit.day.advance", dailyXpDate: date });
  }
  snapshot() {
    const p = this.projections;
    return {
      revision: this.data.envelope.generation,
      appVersion: require("../../../package.json").version,
      date: this.dateAt(),
      settings: this.data.settings,
      dayBlocks: models.dayblock.viewAt(p.dayblock, this.clock().toISOString()),
      recoveryTrackStates: Object.fromEntries(
        p.recovery.tracks.map((track) => [
          track.id,
          models.recovery.trackState(p.recovery, track.id, this.dateAt()),
        ]),
      ),
      eligibleHabitIds: p.habit.habits
        .filter((h) => models.habit.scheduledOn(h, this.dateAt()))
        .map((h) => h.id),
      ...p,
      summary: models.session.summaryAt(p.session, this.clock().toISOString()),
    };
  }
  status() {
    const p = this.projections,
      summary = models.session.summaryAt(p.session, this.clock().toISOString());
    return {
      version: 1,
      revision: this.data.envelope.generation,
      session: p.session.activeSession
        ? {
            id: p.session.activeSession.id,
            status: p.session.activeSession.status,
            focusedMilliseconds: summary.focusedMilliseconds,
            plannedMinutes: p.session.activeSession.plannedMinutes,
          }
        : null,
      lifetimeXp: p.progression.totals.lifetimeXp,
      level: p.progression.level,
      storyRank: p.progression.storyRank,
      events: p.progression.ledger
        .filter((e) => e.lifetimeXp > 0 && !/recovery/i.test(e.reason || ""))
        .slice(-10)
        .map((e) => ({ id: e.id, xp: e.lifetimeXp })),
    };
  }
  execute(
    domain,
    command,
    requestId = crypto.randomUUID(),
    observationTime = null,
  ) {
    if (
      !models[domain] ||
      typeof models[domain].decide !== "function" ||
      !command ||
      typeof command.type !== "string"
    )
      throw new Error("Unsupported domain command");
    if (
      typeof requestId !== "string" ||
      requestId.length < 1 ||
      requestId.length > 128
    )
      throw new Error("Invalid request ID");
    const signature = fingerprint({ domain, command });
    const receipt = this.data.receipts.find((r) => r.id === requestId);
    if (receipt) {
      if (receipt.signature !== signature)
        throw new Error("Request ID was already used for another command");
      return receipt.result;
    }
    const input = structuredClone(command),
      now = this.clock().toISOString(),
      p = this.projections;
    if (domain === "dayblock") {
      input.atUtc = now;
      input.newRunId = crypto.randomUUID();
      input.planId = crypto.randomUUID();
    }
    if (domain === "recovery") input.dailyXpDate = this.dateAt();
    if (domain === "session") {
      if (input.type === "session.start") {
        input.session = {
          ...input.session,
          id: input.session?.id || crypto.randomUUID(),
          startedAtUtc: now,
        };
        const task = [...p.planning.tasks, ...p.planning.occurrences].find(
          (t) => t.id === input.session.taskId,
        );
        if (input.session.taskId && (!task || task.status !== "open"))
          throw new Error("Choose an open Task");
      } else if (!["selection.change"].includes(input.type))
        input.atUtc = observationTime || now;
      if (input.type === "selection.change") {
        input.selectedAtUtc = now;
        input.reminderDelayMinutes ??= 10;
      }
      if (
        input.taskId &&
        ![...p.planning.tasks, ...p.planning.occurrences].some(
          (t) => t.id === input.taskId,
        )
      )
        throw new Error("Task was not found");
      if (input.type === "session.correct") {
        const original = p.session.sessions.find(
          (session) => session.id === input.id,
        );
        if (!original) throw new Error("Session was not found");
        if (input.focusedMilliseconds !== undefined) {
          const effective = models.session.focusedSegments(
            original,
            original.finishedAtUtc,
          );
          input.segments =
            input.focusedMilliseconds === original.focusedMilliseconds
              ? effective
              : models.session.resizeFocusedSegments(
                  effective,
                  input.focusedMilliseconds,
                  now,
                );
        }
        const focused = (input.segments || []).reduce(
          (total, segment) =>
            total +
            Date.parse(segment.endedAtUtc) -
            Date.parse(segment.startedAtUtc),
          0,
        );
        input.sliceContext = original.sliceContext;
        input.dailySlices = original.sliceTimeline?.length
          ? models.session.dailySlicesFromTimeline(
              input.segments,
              original.sliceTimeline,
            )
          : models.session.revisedDailySlices(original.dailySlices, focused);
      }
      if (input.type === "session.finish" && p.session.activeSession) {
        if (p.session.activeSession.inactiveIntervals.length > 0)
          input.inactivityDecision = "exclude";
        input.sliceContext = {
          timezone: Event.systemTimezone(),
          dayBoundaryMinutes: this.data.settings.dayBoundaryMinutes,
        };
        const dateAt = (at) => this.dateAt(new Date(at));
        const slices = models.session.dailySlicesAt(
          p.session.activeSession,
          now,
          dateAt,
        );
        if (slices.length) input.dailySlices = slices;
        input.sliceTimeline = models.session.dailyXpTimelineAt(
          p.session.activeSession.startedAtUtc,
          new Date(Date.parse(now) + 86400000).toISOString(),
          dateAt,
        );
      }
    }
    const decision = models[domain].decide(
      domain === "settings" ? this.data.settings : p[domain],
      input,
    );
    const result = {
      changed: decision.events.length > 0,
      confirmation: decision.confirmation || null,
      preview: decision.preview || null,
    };
    const journal = Journal.appendIntents(
      this.journal,
      decision.events,
      this.context(),
      Event,
    );
    const projected = projectJournal(journal);
    const next = {
      ...this.data,
      settings: projected.settings,
      envelope: State.withEventJournal(
        this.data.envelope,
        Event.exportJournal(journal),
      ),
      receipts: [...this.data.receipts, { id: requestId, signature, result }],
    };
    this.commit(next);
    this.journal = journal;
    this.projections = projected.projections;
    if (decision.events.length) this.emit("change", this.status());
    return result;
  }
  settings(changes) {
    this.execute("settings", { type: "settings.change", changes });
    this.advanceDay();
  }
  reset(confirmation) {
    if (confirmation !== "reset-profile")
      throw new Error("Reset needs confirmation");
    this.write(
      path.join(this.directory, `reset-backup-${crypto.randomUUID()}.json`),
      serialize(this.data),
    );
    const journal = Event.createJournal(crypto.randomUUID());
    this.commit({
      version: 1,
      envelope: State.withEventJournal(
        State.createEnvelope(State.emptyPayload(), 0),
        Event.exportJournal(journal),
      ),
      settings: { ...models.settings.DEFAULTS },
      receipts: [],
    });
    this.reproject();
    this.advanceDay();
    this.emit("change", this.status());
  }
  exportJournal() {
    return Event.exportCheckedJournal(this.journal);
  }
  importLegacy(primary, backup = "") {
    if (
      this.journal.events.some(
        (e) =>
          ![
            "planning.day.advanced",
            "habit.day.advanced",
            "settings.changed",
          ].includes(e.type),
      )
    )
      throw new Error("Import requires an empty desktop profile");
    let parsed;
    try {
      parsed = JSON.parse(primary);
    } catch {
      parsed = null;
    }
    const rawJournal =
      parsed && Array.isArray(parsed.events)
        ? Event.loadJournal(primary)
        : null;
    if (rawJournal && !rawJournal.ok) throw new Error(rawJournal.message);
    const recovered = rawJournal
      ? {
          envelope: State.withEventJournal(
            State.createEnvelope(State.emptyPayload(), 0),
            Event.exportJournal(rawJournal.journal),
          ),
        }
      : State.recoverDetailed(primary, backup);
    if (recovered.error || recovered.fresh)
      throw new Error(recovered.error || "No legacy data found");
    const loaded = Event.loadJournal(
      recovered.envelope.payload.eventJournalRaw,
    );
    if (!loaded.ok) throw new Error(loaded.message);
    const { settings } = projectJournal(loaded.journal);
    this.commit({
      ...this.data,
      settings,
      envelope: recovered.envelope,
      receipts: [],
    });
    this.reproject();
    this.advanceDay();
  }
  observeDesktop(idleSeconds) {
    const active = this.projections.session.activeSession;
    if (active?.status === "running") {
      if (idleSeconds >= 300 && !active.pendingInactivityStartedAtUtc) {
        const segmentStart = Date.parse(active.segments.at(-1).startedAtUtc);
        const idleStart = new Date(
          Math.max(segmentStart, this.clock().getTime() - idleSeconds * 1000),
        ).toISOString();
        this.execute(
          "session",
          { type: "session.inactivity.detect" },
          crypto.randomUUID(),
          idleStart,
        );
      } else if (
        idleSeconds < 300 &&
        active.pendingInactivityStartedAtUtc &&
        !active.pendingInactivityEndedAtUtc
      )
        this.execute("session", { type: "session.inactivity.return" });
    }
    const selection = this.projections.session.selection;
    if (
      !active &&
      selection?.reminderStatus === "scheduled" &&
      Date.parse(selection.reminderDueAtUtc) <= this.clock().getTime()
    )
      this.execute("session", { type: "selection.reminder.due" });
  }
  exportState() {
    return State.encode(this.data.envelope);
  }
}
module.exports = { Core, atomicWrite, validateDocument };
