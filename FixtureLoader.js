// V1 (#93) fixture adapter — the sole stub-driven slice's data source.
// Shaped EXACTLY like StateStore's read API so V2+ slices replace this
// file's consumers one domain at a time with zero UI rewiring.
// Retirement plan (slices.md): planning→V2 · session→V3 · progression→V4 ·
// routines→V5 · habits/overdue→V6 · story/recovery→V7 · settings/bar→V8.

var _committed = false

function emptyFixture() {
    return {
        // planningProjection shape (PlanningModel.emptyProjection)
        planning: {
            commitments: [],
            todayOccurrences: []
        },
        // sessionProjection shape
        session: {
            activeSession: null,
            focusedMilliseconds: 0
        },
        // progressionProjection shape
        progression: {
            level: 3,
            storyRank: "Iron",
            momentum: "Steady",
            totals: { lifetimeXp: 1450, seasonXp: 320 },
            toNextLevel: { need: 650, have: 400 }
        },
        // habitProjection shape
        habit: {
            habits: [
                { id: "fx-habit-1", name: "Read 20 pages", doneToday: false },
                { id: "fx-habit-2", name: "Morning walk", doneToday: true }
            ]
        },
        // storyProjection shape (light motif)
        story: {
            provinces: [
                { id: "fx-goal-1", name: "Learn Rails", progress: 0.4, reclaimed: true },
                { id: "fx-goal-2", name: "Ship DailyXP", progress: 0.15, reclaimed: true }
            ],
            momentumState: "Steady",
            hollowKingPresent: false
        },
        // recoveryProjection shape (private by default)
        recovery: {
            tracks: [
                { id: "fx-track-1", label: "Track A", streakDays: 12, private: true }
            ]
        },
        // settings
        settings: {
            dayBoundaryMinutes: 240,
            reducedMotion: false
        },
        // ux surface mirror
        currentSurface: "Play"
    }
}

// The shell reads through this single entry point; swapping any domain for
// real projections later means replacing these getters' sources only.
var _fixture = null

function load() {
    if (!_fixture) _fixture = emptyFixture()
    return _fixture
}

function reset() {
    _fixture = emptyFixture()
    return _fixture
}
