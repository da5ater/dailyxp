// V1 (#93) fixture adapter — the sole stub-driven slice's data source.
// Field-exact with the REAL model projections (Rex review fix): planning
// mirrors PlanningModel.emptyProjection + occurrenceFromRoutine, habit
// mirrors HabitModel (title/completions), story mirrors StoryModel
// (momentum, provinces via statusMap), progression mirrors ProgressionModel
// (ruleVersion, ledger, totals). Derived views (today's occurrences) are
// computed the way Panel.qml computes them today — from occurrences[] +
// lastAdvancedDailyXpDate — so V2+ slices replace this file's sources
// without a rename pass.
// Retirement plan (slices.md): planning→V2 · session→V3 · progression→V4 ·
// routines→V5 · habits/overdue→V6 · story/recovery→V7 · settings/bar→V8.

function emptyFixture() {
  return {
    // ── planningProjection shape (PlanningModel.emptyProjection) ──
    planning: {
      schemaVersion: 1,
      goals: [
        { id: "fx-goal-1", title: "Learn Rails", status: "active", progressFraction: 0.4 },
        { id: "fx-goal-2", title: "Ship DailyXP", status: "active", progressFraction: 0.15 }
      ],
      milestones: [
        { id: "fx-ms-1", goalId: "fx-goal-1", title: "Finish auth chapter",
          status: "active", rewardXp: 250 }
      ],
      // Task shape mirrors PlanningModel task creation (title/estimateMinutes/
      // primarySkill/deadline/goalId/status)
      tasks: [
        { id: "fx-task-1", title: "Write spike memo", estimateMinutes: 45,
          primarySkill: "writing/arch", deadline: null, goalId: null,
          milestoneId: null, status: "open" },
        { id: "fx-task-2", title: "Review PR #101 feedback",
          estimateMinutes: 30, primarySkill: "backend/ruby", deadline: null,
          goalId: null, milestoneId: null, status: "open" }
      ],
      routines: [
        { id: "fx-routine-1", title: "Study backend Ruby",
          expectedMinutes: 120, primarySkill: "backend/ruby",
          goalId: "fx-goal-1", revision: 1, weekdays: [1,2,3,4,5],
          status: "active" }
      ],
      // occurrence shape = PlanningModel.occurrenceFromRoutine
      occurrences: [
        {
          id: "fx-occ-1", occurrenceKey: "fx-key-1", routineId: "fx-routine-1",
          routineRevision: 1, dailyXpDate: "2026-08-24",
          title: "Study backend Ruby", expectedMinutes: 120,
          primarySkill: "backend/ruby", goalId: "fx-goal-1", milestoneId: null,
          status: "open"
        }
      ],
      proposals: [],
      lastAdvancedDailyXpDate: "2026-08-24"
    },

    // ── sessionProjection shape ──
    session: {
      activeSession: null,
      selection: null,
      sessions: [],
      focusedMilliseconds: 0
    },

    // ── progressionProjection shape (ProgressionModel.emptyProjection) ──
    progression: {
      schemaVersion: 1,
      ruleVersion: 1,
      ledger: [
        { id: "fx-ledger-3", reason: "Habit completed — Morning walk",
          lifetimeDelta: 20, seasonDelta: 20,
          atUtc: "2026-08-24T07:30:00Z", ruleVersion: 1 },
        { id: "fx-ledger-2", reason: "Focused 52m — Write spike memo",
          lifetimeDelta: 52, seasonDelta: 52,
          atUtc: "2026-08-24T08:52:00Z", ruleVersion: 1 },
        { id: "fx-ledger-1", reason: "Fixture seed history",
          lifetimeDelta: 1378, seasonDelta: 248,
          atUtc: "2026-08-23T12:00:00Z", ruleVersion: 1 }
      ],
      totals: { lifetimeXp: 1450, seasonXp: 320 },
      // levelForXp(1450): L1 needs 500 (have 950), L2 needs 550 (have 400),
      // L3 needs 600 > 400 → level 3, rank Wanderer per STORY_RANKS.
      level: 3,
      storyRank: "Wanderer",
      momentum: "Steady",
      seasonId: 1,
      dailyTargetMinutes: 120,
      streakBonus: 0
    },

    // ── habitProjection shape (HabitModel.emptyProjection) ──
    habit: {
      schemaVersion: 1,
      habits: [
        { id: "fx-habit-1", title: "Read 20 pages", schedule: { kind: "daily" }, archived: false },
        { id: "fx-habit-2", title: "Morning walk", schedule: { kind: "daily" }, archived: false },
        { id: "fx-habit-3", title: "No phone before breakfast", schedule: { kind: "daily" }, archived: false },
        { id: "fx-habit-4", title: "Journal entry", schedule: { kind: "weekdays" }, archived: false }
      ],
      completions: [
        { id: "fx-comp-1", habitId: "fx-habit-2", dailyXpDate: "2026-08-24" },
        { id: "fx-comp-2", habitId: "fx-habit-4", dailyXpDate: "2026-08-24" }
      ],
      freezes: [],
      lastAdvancedDailyXpDate: "2026-08-24",
      streaks: { "fx-habit-1": 5, "fx-habit-2": 12, "fx-habit-3": 0, "fx-habit-4": 3 },
      dailySummaries: {
        "2026-08-24": { scheduledCount: 4, completedCount: 2 }
      }
    },

    // ── storyProjection shape (StoryModel.emptyProjection) ──
    story: {
      schemaVersion: 1,
      provinces: [
        { id: "fx-goal-1", title: "Learn Rails", status: "active",
          goalStatus: "active" },
        { id: "fx-goal-2", title: "Ship DailyXP", status: "active",
          goalStatus: "active" }
      ],
      landmarks: [
        { id: "fx-ms-1", provinceId: "fx-goal-1", title: "Finish auth chapter",
          achieved: false }
      ],
      antagonists: [
        { id: "fx-ant-1", kind: "drift", causeLine: "Two routine days slipped this week." }
      ],
      momentum: "Steady",
      comebackQuest: null,
      achievements: [
        { id: "fx-ach-1", family: "focus", title: "First Hour",
          earnedAtUtc: "2026-08-22T09:00:00Z" },
        { id: "fx-ach-2", family: "habits", title: "Week Streak",
          earnedAtUtc: "2026-08-20T18:00:00Z" }
      ]
    },

    // ── recoveryProjection shape (RecoveryModel.emptyProjection) ──
    recovery: {
      schemaVersion: 1,
      tracks: [
        { id: "fx-track-1", category: "social_media", startDate: "2026-08-12",
          visibility: "private" },
        { id: "fx-track-2", category: "custom", customCategory: "Deep-work diet",
          startDate: "2026-08-01", visibility: "private" }
      ],
      attempts: [
        { id: "fx-attempt-1", trackId: "fx-track-1",
          startedDate: "2026-08-12", endedDate: null, active: true,
          currentStreakDays: 12 },
        { id: "fx-attempt-2", trackId: "fx-track-2",
          startedDate: "2026-08-01", endedDate: null, active: true,
          currentStreakDays: 23 }
      ],
      checkIns: [],
      milestones: [
        { id: "fx-rm-1", attemptId: "fx-attempt-1", days: 7,
          earnedDate: "2026-08-19" }
      ],
      xp: 140
    },

    // ── uxProjection shape (UxModel.emptyProjection) ──
    ux: {
      currentSurface: "Play",
      sheets: [],
      reducedMotion: false,
      scale: 1,
      highContrast: false,
      focusVisible: true
    }
  };
}

// ── derived views — computed exactly as Panel.qml does today ──────────

function todays(fixture) {
  var p = fixture.planning;
  var today = p.lastAdvancedDailyXpDate;
  if (!today) return [];
  var out = [];
  for (var i = 0; i < p.occurrences.length; i++) {
    var o = p.occurrences[i];
    if (o.dailyXpDate === today && (o.status === "open" || o.status === "completed"))
      out.push(o);
  }
  return out;
}

function overdue(fixture) {
  var out = [];
  var occs = fixture.planning.occurrences;
  for (var i = 0; i < occs.length; i++) if (occs[i].status === "overdue") out.push(occs[i]);
  return out;
}

function habitDoneToday(fixture, habit) {
  var c = fixture.habit.completions;
  var today = fixture.habit.lastAdvancedDailyXpDate;
  for (var i = 0; i < c.length; i++)
    if (c[i].habitId === habit.id && c[i].dailyXpDate === today) return true;
  return false;
}

function hhmm(milliseconds) {
    var totalMinutes = Math.floor(Number(milliseconds || 0) / 60000)
    var h = Math.floor(totalMinutes / 60)
    var m = totalMinutes % 60
    return h > 0 ? h + "h " + m + "m" : m + "m"
}

// XP-to-next-level mirroring ProgressionModel.levelForXp exactly:
// requirement to LEAVE level L is LEVEL_BASE + LEVEL_STEP·(L−1).
function levelProgress(fixture) {
  var t = fixture.progression.totals.lifetimeXp;
  var level = fixture.progression.level;
  var consumed = 0;
  for (var l = 1; l < level; l++) {
    var req = 500 + 50 * (l - 1);
    consumed += req;
  }
  var need = 500 + 50 * (level - 1);
  return { have: Math.max(0, t - consumed), need: need };
}

var _fixture = null;

function load() {
  if (!_fixture) _fixture = emptyFixture();
  return _fixture;
}

function reset() {
  _fixture = emptyFixture();
  return _fixture;
}
