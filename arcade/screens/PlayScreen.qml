pragma ComponentBehavior: Bound
import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader
import "../../EventModel.js" as EventModel
import "../../SessionModel.js" as SessionModel
import "../../RoutineView.js" as RoutineView
import "../../HabitView.js" as HabitView
import "../../HabitModel.js" as HabitModel

// P1: PLAY — the dominant daily surface (full cockpit, stub data).
// Everything PLAY owns is present: selection chips, today rail, session
// start, Daily Target bar, habits with streaks, overdue placeholder,
// Recovery guarded entry. Real behavior lands serially V2–V7.
ArcadeScreen {
    id: root
    title: "PLAY"

    // V2 (#94): fixture loads ONLY when unbound (harness). The bound path
    // reads the real planningProjection — never both, never the form.
    readonly property var store: shellApi ? shellApi.stateStore : null
    readonly property bool bound: store !== null && store.planningProjection !== undefined
    readonly property var fixture: bound ? null : FixtureLoader.load()

    readonly property var todayList: bound
        ? RoutineView.todayOccurrences(store.planningProjection, store.planningProjection.lastAdvancedDailyXpDate)
        : (fixture ? FixtureLoader.todays(fixture) : [])
    readonly property var taskList: bound ? todayList.concat(store.planningProjection.tasks || [])
        : (fixture ? fixture.planning.tasks : [])
    readonly property bool hasAnyCommitments: bound
        ? (store.planningProjection.tasks || []).length > 0
          || (store.planningProjection.routines || []).length > 0
          || (store.planningProjection.occurrences || []).length > 0
        : !!fixture && (fixture.planning.tasks.length > 0 || fixture.planning.routines.length > 0
            || fixture.planning.occurrences.length > 0)

    // selected commitment for the rail (#94 live finding: with 3+ commitments
    // there was no way to choose which one leads). Index into taskList;
    // clamped so deletions/replays can never point past the end.
    property int selectedTaskIndex: 0
    readonly property int focusIndex: Math.max(0, Math.min(selectedTaskIndex, taskList.length - 1))
    readonly property var focusTask: taskList.length > 0 ? taskList[focusIndex] : null

    readonly property var sessionProjection: bound && store.sessionProjection ? store.sessionProjection : null
    readonly property var activeSession: sessionProjection ? sessionProjection.activeSession : null
    readonly property bool sessionReady: bound && store.ready && store.recordingReady && !store.saving
    property string nowUtc: new Date().toISOString()
    readonly property var sessionSummary: activeSession ? SessionModel.summaryAt(sessionProjection, nowUtc) : null
    readonly property var sessionTask: {
        if (!activeSession) return null
        for (var i = 0; i < taskList.length; i++)
            if (taskList[i].id === activeSession.taskId) return taskList[i]
        if (bound) {
            var occurrences = store.planningProjection.occurrences
            for (var j = 0; j < occurrences.length; j++)
                if (occurrences[j].id === activeSession.taskId) return RoutineView.occurrenceTask(occurrences[j])
        }
        return null
    }
    readonly property var railTask: activeSession ? sessionTask : focusTask
    readonly property var lastFinished: {
        var sessions = sessionProjection ? sessionProjection.sessions : []
        for (var i = sessions.length - 1; i >= 0; i--)
            if (sessions[i].status === "finished") return sessions[i]
        return null
    }
    readonly property bool sessionControlFocused: startButton.activeFocus || pauseButton.activeFocus || finishButton.activeFocus || quickControlFocused()
    readonly property var confirmation: bound ? store.sessionConfirmation : null
    readonly property bool capConfirmation: confirmation && confirmation.reasons.indexOf("daily-cap") !== -1

    function elapsedText(milliseconds) {
        var seconds = Math.floor(milliseconds / 1000)
        return String(Math.floor(seconds / 3600)).padStart(2, "0") + ":"
            + String(Math.floor(seconds / 60) % 60).padStart(2, "0") + ":"
            + String(seconds % 60).padStart(2, "0")
    }
    readonly property bool modalOpen: shellApi && (shellApi.sheetStack.length > 0 || shellApi.recoveryOpen)
    property string lastSessionKey: ""
    function focusSessionControl(direction) {
        if (modalOpen) return false
        var control = activeSession ? (direction < 0 ? finishButton : pauseButton) : startButton
        if (!control.visible || !control.enabled) return false
        control.forceActiveFocus()
        if (shellApi) shellApi.revealControl(control)
        return true
    }
    function startFocus() {
        if (modalOpen || !sessionReady || activeSession || !focusTask) return
        store.applySessionCommand({ type: "session.start", session: {
            id: EventModel.uuidV4(), taskId: focusTask.id, primarySkill: focusTask.primarySkill,
            plannedMinutes: null, startedAtUtc: new Date().toISOString()
        } })
    }
    function togglePause() {
        if (modalOpen || !sessionReady || !activeSession) return
        store.applySessionCommand({ type: activeSession.status === "running" ? "session.pause" : "session.resume",
                                    atUtc: new Date().toISOString() })
    }
    function finishFocus(acknowledgeCap) {
        if (modalOpen || !sessionReady || !activeSession) return
        store.applySessionCommand({ type: "session.finish", atUtc: new Date().toISOString(),
            inactivityDecision: "exclude", dailyCapAcknowledged: acknowledgeCap === true })
    }
    onActiveSessionChanged: {
        nowUtc = new Date().toISOString()
        var key = activeSession ? activeSession.id + ":" + activeSession.status : ""
        if (key !== lastSessionKey && visible) Qt.callLater(function() { root.focusSessionControl(1) })
        lastSessionKey = key
    }
    Timer {
        interval: 1000
        repeat: true
        running: root.visible && root.activeSession && root.activeSession.status === "running"
        triggeredOnStart: true
        onTriggered: root.nowUtc = new Date().toISOString()
    }

    // ── selection + today rail ─────────────────────────────────
    ArcadeCard {
        id: railCard
        visible: root.activeSession !== null || root.todayList.length > 0 || root.focusTask !== null
        emphasized: true                      // the signature card — one per surface
        width: parent.width
        ribbon: "TODAY · FOCUS"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep

        Text {
            objectName: "railCommitmentTitle"
            width: parent.width
            text: !root.bound && root.todayList.length > 0
                  ? root.todayList[0].title
                  : (root.railTask ? root.railTask.title : "Free focus")
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTitle
            font.bold: true
            elide: Text.ElideRight
        }
        Text {
            objectName: "railCommitmentDetail"
            width: parent.width
            text: {
                var o = !root.bound && root.todayList.length > 0 ? root.todayList[0] : null
                var t = o ? null : root.railTask
                if (o) return o.expectedMinutes + "m budget · " + o.primarySkill
                if (t) return t.estimateMinutes + "m · " + t.primarySkill + (t.kind === "routine" ? " · routine today" : " · one-shot")
                return ""
            }
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        // goal badge: only when the commitment is tied to a direction
        // (goalId set on the task by the Commitment Sheet). Resolves the
        // goal title from the projection so the rail reflects saved state.
        readonly property var focusGoalId: root.railTask ? root.railTask.goalId || null : null
        readonly property var focusGoal: {
            if (!root.bound || !railCard.focusGoalId || !store) return null
            var gs = store.planningProjection.goals || []
            for (var i = 0; i < gs.length; i++) if (gs[i].id === railCard.focusGoalId) return gs[i]
            return null
        }
        StatChip {
            width: Math.min(implicitWidth, parent.width)
            visible: railCard.focusGoal !== null
            compact: true
            label: ""
            value: railCard.focusGoal ? "GOAL · " + railCard.focusGoal.title : ""
            valueColor: Theme.cyberPurple
        }
        Text {
            objectName: "sessionTimer"
            visible: root.activeSession !== null
            width: parent.width
            text: root.sessionSummary ? root.elapsedText(root.sessionSummary.focusedMilliseconds) : "00:00:00"
            color: root.activeSession && root.activeSession.status === "paused" ? Theme.textMuted : Theme.arcadeBlue
            font.family: "monospace"
            font.pixelSize: 30
            horizontalAlignment: Text.AlignHCenter
            Accessible.name: "Focused time " + text
        }
        Text {
            objectName: "sessionState"
            visible: root.activeSession !== null
            width: parent.width
            text: root.activeSession && root.activeSession.status === "paused" ? "PAUSED · time is held" : "FOCUSING · continuous session"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        BevelButton {
            id: startButton
            objectName: "startSessionButton"
            visible: root.activeSession === null
            label: "▶ START SESSION"
            width: parent.width - Theme.space(2)
            anchors.horizontalCenter: parent.horizontalCenter
            enabled: root.sessionReady && root.focusTask !== null
            opacity: enabled ? 1 : 0.55
            onActivated: root.startFocus()
        }
        Row {
            visible: root.activeSession !== null
            width: parent.width
            spacing: Theme.space(2)
            BevelButton {
                id: pauseButton
                objectName: "pauseSessionButton"
                width: (parent.width - parent.spacing) / 2
                label: root.activeSession && root.activeSession.status === "paused" ? "RESUME" : "PAUSE"
                enabled: root.sessionReady && root.activeSession !== null
                onActivated: root.togglePause()
            }
            BevelButton {
                id: finishButton
                objectName: "finishSessionButton"
                width: (parent.width - parent.spacing) / 2
                label: root.capConfirmation ? "CONFIRM" : "FINISH"
                baseColor: Theme.powerGreen
                textColor: Theme.greenDeep
                enabled: root.sessionReady && root.activeSession !== null
                onActivated: root.finishFocus(root.capConfirmation)
            }
        }
        Text {
            visible: root.confirmation !== null
            width: parent.width
            text: root.capConfirmation
                ? "Daily competitive cap reached. Confirm to keep focused history and apply the cap."
                : "Finish needs inactivity confirmation. Resume your session, then try Finish again."
            color: Theme.chromeYellow
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        Text {
            objectName: "sessionResult"
            visible: !root.activeSession && root.lastFinished !== null
            width: parent.width
            text: root.lastFinished ? "SAVED · " + root.elapsedText(root.lastFinished.focusedMilliseconds) + " focused" : ""
            color: Theme.powerGreen
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        Text {
            visible: root.bound && store.errorMessage !== ""
            width: parent.width
            text: root.bound ? store.errorMessage : ""
            color: Theme.chromeYellow
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        Flow {
            width: parent.width
            spacing: Theme.space(2)
            Repeater {
                model: root.activeSession ? [] : root.taskList
                delegate: Row {
                    id: taskRow
                    required property int index
                    required property var modelData
                    width: parent.width
                    spacing: Theme.space(1)
                    // resolve the linked goal title for the per-task badge
                    readonly property var taskGoal: {
                        if (!root.bound || !modelData.goalId || !store) return null
                        var gs = store.planningProjection.goals || []
                        for (var i = 0; i < gs.length; i++) if (gs[i].id === modelData.goalId) return gs[i]
                        return null
                    }
                    StatChip {
                        id: chip
                        width: Math.min(implicitWidth, (taskRow.width - delHit.width - taskRow.spacing * 2) / (taskRow.taskGoal ? 2 : 1))
                        compact: true
                        label: taskRow.index === root.focusIndex ? "●" : "○"
                        value: taskRow.modelData.title
                        valueColor: taskRow.index === root.focusIndex ? "#ffebc4" : Theme.textMuted
                        objectName: "selectCommitment" + taskRow.index
                        interactive: true
                        onActivated: root.selectedTaskIndex = taskRow.index
                    }
                    // per-task goal badge — direction the commitment is tied to
                    StatChip {
                        visible: taskRow.taskGoal !== null
                        width: Math.max(0, taskRow.width - chip.width - delHit.width - taskRow.spacing * 2)
                        compact: true
                        label: ""
                        value: taskRow.taskGoal ? taskRow.taskGoal.title : ""
                        valueColor: Theme.cyberPurple
                    }
                    // delete: red X removes the commitment via the engine
                    Rectangle {
                        id: delHit
                        visible: taskRow.modelData.kind !== "routine"
                        width: 22; height: 22; radius: 11
                        color: delMouse.containsMouse ? "#ff3b5c" : Theme.surfaceLow
                        border.color: Theme.border; border.width: 1
                        Text { anchors.centerIn: parent; text: "✕"; color: "#ff3b5c"
                               font.family: Theme.fontFamily; font.pixelSize: Theme.typeBody }
                        MouseArea {
                            id: delMouse
                            anchors.fill: parent; hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (store && typeof store.applyPlanningCommand === "function")
                                    store.applyPlanningCommand({
                                        type: "entity.remove", entityType: "task", id: taskRow.modelData.id })
                                if (root.selectedTaskIndex >= root.taskList.length - 1)
                                    root.selectedTaskIndex = Math.max(0, root.taskList.length - 2)
                            }
                        }
                    }
                }
            }
        }
    }

    // ── V2 empty state ──────────────────────────────────────────
    ArcadeCard {
        visible: !root.hasAnyCommitments
        width: parent.width
        ribbon: "NEW DAY"
        ribbonColor: Theme.powerGreen

        Text {
            width: parent.width
            text: "Set your first commitment.\nName it, give it a daily time budget — then press start."
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            lineHeight: 1.4
            wrapMode: Text.WordWrap
        }
        BevelButton {
            objectName: "setFirstCommitmentButton"
            label: "+ SET FIRST COMMITMENT"
            width: parent.width - Theme.space(2)
            anchors.horizontalCenter: parent.horizontalCenter
            onActivated: if (root.shellApi) root.shellApi.openCommitmentSheet()
        }
    }

    // ── V2 add-commitment entry — persists after the first commitment ──
    BevelButton {
        objectName: "addCommitmentButton"
        visible: root.hasAnyCommitments
        label: "+ NEW COMMITMENT"
        baseColor: Theme.surfaceHigh
        textColor: "#ffebc4"
        width: parent.width - Theme.space(2)
        anchors.horizontalCenter: parent.horizontalCenter
        onActivated: if (root.shellApi) root.shellApi.openCommitmentSheet()
    }

    // ── daily target progress ───────────────────────────────────
    // V2 bound mode: focused time arrives with V3 sessions, so the bar sits
    // at zero; fixture mode keeps the V1 stub read. Guarded derefs — QML
    // evaluates bindings even while a card is invisible.
    ArcadeCard {
        id: targetCard
        visible: root.hasAnyCommitments
        width: parent.width
        ribbon: "DAILY TARGET"
        ribbonColor: Theme.manaPurple
        ribbonText: Theme.purpleSoft

        readonly property real focusedMs: root.bound ? 0
            : (root.fixture ? root.fixture.session.focusedMilliseconds : 0)
        readonly property int targetMin: root.bound ? 60
            : (root.fixture ? root.fixture.progression.dailyTargetMinutes : 60)

        SegmentedBar {
            blocks: 20
            width: parent.width - Theme.space(4)
            // id refs, NOT parent.* — inside an ArcadeCard, parent is the
            // card's internal content item, which has none of these
            // properties (live finding #94: printed "of undefinedm")
            fraction: Math.min(1, (targetCard.focusedMs / 60000) / targetCard.targetMin)
            fill: Theme.manaPurple
            fillBorder: Theme.purpleDeep
        }
        Text {
            width: parent.width
            text: FixtureLoader.hhmm(targetCard.focusedMs)
                  + " focused of " + targetCard.targetMin + "m target today"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
    }

    readonly property string habitDate: bound ? root.store.habitProjection.lastAdvancedDailyXpDate || "" : ""
    readonly property var todayHabits: bound ? HabitView.todayHabits(root.store.habitProjection, habitDate, HabitModel) : []
    readonly property var gentle: bound ? HabitView.gentleSuggestion(root.store.planningProjection) : null
    property string pendingSmallId: ""

    function quickControlFocused() {
        for (var i = 0; i < habitRepeater.count; i++) {
            var row = habitRepeater.itemAt(i)
            if (!row) continue
            for (var k = 0; k < row.children.length; k++)
                if (row.children[k].activeFocus) return true
        }
        for (var j = 0; j < overdueRepeater.count; j++) {
            var control = overdueRepeater.itemAt(j)
            if (control && control.activeFocus) return true
        }
        return false
    }
    function revealQuickControl(control) {
        if (control.activeFocus && shellApi) shellApi.revealControl(control)
    }

    function habitAction(habit, action) {
        if (!sessionReady || modalOpen || habit.state !== "open") return
        root.store.applyHabitCommand({ type: "habit." + action, habitId: habit.id, dailyXpDate: habitDate })
    }
    function disposeOverdue(action) {
        if (!sessionReady || modalOpen || !gentle || activeSession) return
        var id = gentle.id
        var today = root.store.planningProjection.lastAdvancedDailyXpDate
        if (root.store.applyPlanningCommand({ type: "overdue.disposition", id: id, action: action, dailyXpDate: today })
            && action === "smaller") pendingSmallId = "gentle:" + encodeURIComponent(id) + ":day:" + today
    }
    Connections {
        target: root.store
        function onPersisted() {
          Qt.callLater(function() {
            if (!root.pendingSmallId || root.store.saving) return
            var id = root.pendingSmallId
            root.pendingSmallId = ""
            for (var i = 0; i < root.taskList.length; i++) {
                if (root.taskList[i].id === id) {
                    root.selectedTaskIndex = i
                    root.startFocus()
                    return
                }
            }
          })
        }
    }

    ArcadeCard {
        objectName: "habitStrip"
        visible: root.todayHabits.length > 0
        width: parent.width
        ribbon: "HABITS"
        ribbonColor: Theme.powerGreen
        Text {
            width: parent.width
            text: "Tap to complete · hold or choose Skip to pass today"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTiny
            wrapMode: Text.WordWrap
        }
        Repeater {
            id: habitRepeater
            model: root.todayHabits
            delegate: Row {
                id: habitRow
                required property var modelData
                required property int index
                width: parent.width
                spacing: Theme.space(2)
                HabitChip {
                    id: habitChip
                    objectName: "habitChip" + habitRow.index
                    width: Math.max(0, parent.width - skipHabit.width - parent.spacing)
                    onActiveFocusChanged: root.revealQuickControl(this)
                    title: habitRow.modelData.title
                    stateLabel: habitRow.modelData.state
                    streak: habitRow.modelData.streak
                    enabled: root.sessionReady && !root.modalOpen
                    onCompleted: root.habitAction(habitRow.modelData, "complete")
                    onSkipped: root.habitAction(habitRow.modelData, "skip")
                }
                BevelButton {
                    id: skipHabit
                    onActiveFocusChanged: root.revealQuickControl(this)
                    objectName: "skipHabit" + habitRow.index
                    width: 92
                    label: "SKIP"
                    baseColor: Theme.surfaceHigh
                    textColor: Theme.textMuted
                    enabled: root.sessionReady && !root.modalOpen && habitRow.modelData.state === "open"
                    opacity: enabled ? 1 : 0.5
                    onActivated: root.habitAction(habitRow.modelData, "skip")
                }
            }
        }
    }
    ArcadeCard {
        objectName: "overdueStrip"
        visible: root.gentle !== null
        width: parent.width
        ribbon: "A SMALL WAY BACK"
        ribbonColor: Theme.manaPurple
        Text {
            objectName: "gentleSuggestion"
            width: parent.width
            text: root.gentle ? root.gentle.title + " · one small step is enough." : ""
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WrapAnywhere
        }
        Flow {
            width: parent.width
            spacing: Theme.space(2)
            Repeater {
                id: overdueRepeater
                model: [{ action: "smaller", label: "START SMALLER" },
                        { action: "reschedule", label: "TOMORROW" }, { action: "skip", label: "SKIP" }]
                delegate: BevelButton {
                    required property var modelData
                    objectName: "overdue" + modelData.action
                    onActiveFocusChanged: root.revealQuickControl(this)
                    width: parent.width
                    label: modelData.label
                    baseColor: Theme.surfaceHigh
                    textColor: Theme.textPrimary
                    enabled: root.sessionReady && !root.modalOpen && !root.activeSession
                    opacity: enabled ? 1 : 0.5
                    onActivated: root.disposeOverdue(modelData.action)
                }
            }
        }
    }
    Text {
        visible: root.bound && root.store.errorMessage !== "" && (root.todayHabits.length > 0 || root.gentle !== null)
        width: parent.width
        text: root.bound ? root.store.errorMessage : ""
        color: Theme.chromeYellow
        font.family: Theme.fontFamily
        font.pixelSize: Theme.typeBody
        wrapMode: Text.WordWrap
    }

    // ── recovery guarded entry (R4.4) ───────────────────────────
    // text width derives from the button's REAL width (implicitWidth grows
    // with the label); reserving a constant previously let this line paint
    // past the card's right edge (#93 horizontal-overflow fix)
    Row {
        id: recoveryRow
        width: parent.width
        spacing: Theme.space(2)

        BevelButton {
            id: recoveryButton
            label: "RECOVERY"
            baseColor: Theme.arcadeBlue
            textColor: Theme.onBlue
            onActivated: if (root.shellApi) root.shellApi.openRecovery()
        }
        Text {
            text: "private by default"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTiny
            anchors.verticalCenter: parent.verticalCenter
            width: recoveryRow.width - recoveryButton.width
                   - Theme.space(4)
            wrapMode: Text.WordWrap
        }
    }
}
