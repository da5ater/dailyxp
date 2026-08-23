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
      milestones: [],
      tasks: [],
      routines: [],
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
        { id: "fx-ledger-1", reason: "fixture seed", lifetimeDelta: 1450,
          seasonDelta: 320, atUtc: "2026-08-23T12:00:00Z", ruleVersion: 1 }
      ],
      totals: { lifetimeXp: 1450, seasonXp: 320 },
      level: 3,
      storyRank: "Iron",
      momentum: "Steady",
      seasonId: 1,
      dailyTargetMinutes: 240,
      streakBonus: 0
    },

    // ── habitProjection shape (HabitModel.emptyProjection) ──
    habit: {
      schemaVersion: 1,
      habits: [
        { id: "fx-habit-1", title: "Read 20 pages", schedule: {}, archived: false },
        { id: "fx-habit-2", title: "Morning walk", schedule: {}, archived: false }
      ],
      completions: [
        { id: "fx-comp-1", habitId: "fx-habit-2", dailyXpDate: "2026-08-24" }
      ],
      freezes: [],
      lastAdvancedDailyXpDate: "2026-08-24",
      streaks: {},
      dailySummaries: {}
    },

    // ── storyProjection shape (StoryModel.emptyProjection) ──
    story: {
      schemaVersion: 1,
      provinces: [
        { id: "px-1", goalId: "fx-goal-1", name: "Learn Rails",
          status: "active", fillFraction: 0.4 },
        { id: "px-2", goalId: "fx-goal-2", name: "Ship DailyXP",
          status: "active", fillFraction: 0.15 }
      ],
      antagonists: [],
      momentum: "Steady",
      comebackQuest: null,
      achievements: []
    },

    // ── recoveryProjection shape (RecoveryModel.emptyProjection) ──
    recovery: {
      schemaVersion: 1,
      tracks: [
        { id: "fx-track-1", category: "custom", customCategory: "Track A",
          startDate: "2026-08-12", visibility: "private" }
      ],
      attempts: [],
      checkIns: [],
      milestones: [],
      xp: 0
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

// XP-to-next-level per ProgressionModel.levelForXp rule (500+50n).
function levelProgress(fixture) {
  var t = fixture.progression.totals.lifetimeXp;
  var level = fixture.progression.level;
  var consumed = 0;
  for (var l = 1; l < level; l++) consumed += 500 + 50 * l;
  var need = 500 + 50 * level;
  return { have: t - consumed, need: need };
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
