import QtQuick
import "../"
import "../../EventModel.js" as EventModel

ArcadeSheet {
    id: sheet
    title: "NEW COMMITMENT"
    initialFocusItem: nameField

    // host handle — ShellContent injects itself; .stateStore carries the
    // real engine (StateStore in production, store-alike in the harness)
    property var shellApi: null
    readonly property var store: shellApi ? shellApi.stateStore : null

    property string errorText: ""
    property var pendingTask: null
    property string saveStage: ""
    readonly property bool busy: pendingTask !== null
    dismissEnabled: !busy
    readonly property string chosenGoalTitle: goalField.text.trim()
    readonly property var resolvedGoal: {
        if (chosenGoalTitle === "") return null
        var goals = store ? store.planningProjection.goals : []
        for (var i = 0; i < goals.length; i++)
            if (goals[i].title.toLowerCase() === chosenGoalTitle.toLowerCase())
                return { title: goals[i].title, isExisting: true }
        return { title: chosenGoalTitle, isExisting: false }
    }

    function failSave(message) {
        pendingTask = null
        saveStage = ""
        errorText = message
    }
    function saveTask() {
        saveStage = "task"
        if (!store.applyPlanningCommand({ type: "task.create", task: pendingTask }))
            failSave(store.errorMessage || "COULD NOT SAVE")
    }
    function continueSave() {
        if (!busy || store.saving) return
        if (store.errorMessage !== "") { failSave(store.errorMessage); return }
        if (saveStage === "goal") {
            var goals = store.planningProjection.goals
            for (var i = 0; i < goals.length; i++)
                if (goals[i].id === pendingTask.goalId) { saveTask(); return }
            failSave("GOAL SAVE FAILED")
        } else if (saveStage === "task") {
            var tasks = store.planningProjection.tasks
            for (var j = 0; j < tasks.length; j++)
                if (tasks[j].id === pendingTask.id) {
                    pendingTask = null
                    saveStage = ""
                    sheet.dismissed()
                    return
                }
            failSave("COULD NOT SAVE")
        }
    }
    function save() {
        if (busy || (store && store.saving)) return
        errorText = ""
        if (nameField.text.trim() === "") { errorText = "NAME IT FIRST"; return }
        var minutesText = minutesField.text.trim()
        var minutes = Number(minutesText)
        if (!/^\d+$/.test(minutesText) || minutes < 1 || minutes > 1440) {
            errorText = "MINUTES MUST BE 1–1440"
            return
        }
        if (!store || !store.ready || !store.recordingReady) { errorText = "ENGINE OFFLINE"; return }
        var goalId = null
        var createGoal = false
        if (chosenGoalTitle !== "") {
            var goals = store.planningProjection.goals
            for (var i = 0; i < goals.length; i++)
                if (goals[i].title.toLowerCase() === chosenGoalTitle.toLowerCase()) goalId = goals[i].id
            createGoal = goalId === null
            if (createGoal) goalId = EventModel.uuidV4()
        }
        pendingTask = { id: EventModel.uuidV4(), title: nameField.text.trim(), estimateMinutes: minutes,
                        urgency: "normal", deadline: null, primarySkill: "general/focus",
                        goalId: goalId, milestoneId: null }
        if (createGoal) {
            saveStage = "goal"
            if (!store.applyPlanningCommand({ type: "goal.create", goal: {
                id: goalId, title: chosenGoalTitle, primarySkill: "general/focus",
                reason: "created from Commitment Sheet" } })) failSave(store.errorMessage || "GOAL SAVE FAILED")
        } else saveTask()
    }
    Connections {
        target: sheet.store
        function onPersisted() { if (sheet.busy) Qt.callLater(sheet.continueSave) }
        function onErrorMessageChanged() {
            if (sheet.busy && sheet.store.errorMessage !== "") sheet.failSave(sheet.store.errorMessage)
        }
    }
    function clearName() { nameField.text = ""; nameField.forceActiveFocus() }
    function clearGoal() { goalField.text = ""; goalField.forceActiveFocus() }
    function clearMinutes() { minutesField.text = "30"; minutesField.forceActiveFocus() }

    Column {
        enabled: !sheet.busy
        width: parent.width
        spacing: Theme.space(3)

        Text {
            width: parent.width
            text: "Name today's commitment."
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTiny
            wrapMode: Text.WordWrap
        }

        // ── NAME ────────────────────────────────────────────────
        Rectangle {
            id: nameBox
            width: parent.width
            height: Theme.space(11)
            color: Theme.surfaceLowest
            border.color: nameField.activeFocus ? Theme.coinGold : Theme.border
            border.width: nameField.activeFocus ? 2 : 1

            TextInput {
                id: nameField
                objectName: "commitmentNameInput"
                anchors.fill: parent
                anchors.margins: Theme.space(2)
                verticalAlignment: TextInput.AlignVCenter
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                clip: true
                maximumLength: 60
                activeFocusOnTab: true
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(parent)
                cursorVisible: activeFocus
                KeyNavigation.tab: goalField
                onTextEdited: sheet.errorText = ""

                Text {
                    visible: nameField.text === "" && !nameField.activeFocus
                    text: "RUBY STUDY…"
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }

        // ── GOAL (optional — live pass 2026-08-25) ────────────────
        // Empty → standalone one-time Task. Named → find-or-create a Goal
        // and link the Task via goalId (engine: resolveGoalMilestoneLinks).
        // True recurring Routines stay V5 (#97); this only ties work to a
        // direction, which CONTEXT.md already allows for Tasks.
        //
        // Options picker (2026-08-25 live pass): previously created goals
        // appear as clickable chips so "first programming job" can be
        // reused without retyping. Selecting fills + focuses the field —
        // typing anything new finds-or-creates at save.
        Rectangle {
            id: goalBox
            width: parent.width
            height: Theme.space(11)
            color: Theme.surfaceLowest
            border.color: goalField.activeFocus ? Theme.coinGold : Theme.border
            border.width: goalField.activeFocus ? 2 : 1

            TextInput {
                id: goalField
                objectName: "commitmentGoalInput"
                anchors.fill: parent
                anchors.margins: Theme.space(2)
                verticalAlignment: TextInput.AlignVCenter
                color: Theme.cyberPurple
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                clip: true
                maximumLength: 60
                activeFocusOnTab: true
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(parent)
                cursorVisible: activeFocus
                KeyNavigation.tab: goalRepeater.count > 0 ? goalRepeater.itemAt(0) : minutesField

                Text {
                    visible: goalField.text === "" && !goalField.activeFocus
                    text: "GOAL · OPTIONAL — tie it to a direction"
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }

        // live picker: any Goal from the projection + an "add custom" chip
        // that just focuses the field (saves only when named + SAVE pressed)
        Flow {
            id: goalOptions
            width: parent.width
            visible: store !== null
            spacing: Theme.space(1)

            readonly property var allGoals: store ? store.planningProjection.goals : []
            readonly property var options: {
                var list = []
                var typed = goalField.text.trim().toLowerCase()
                for (var i = 0; i < allGoals.length; i++) {
                    var g = allGoals[i]
                    if (typed === "" || g.title.toLowerCase().indexOf(typed) !== -1 ||
                        g.title.toLowerCase() === typed)
                        list.push({ id: g.id, title: g.title, isCustom: false })
                }
                // always offer the free-text "add" choice so a brand-new
                // goal is one click away even when options exist
                list.push({ id: null, title: "ADD GOAL", isCustom: true })
                return list
            }

            Repeater {
                id: goalRepeater
                model: goalOptions.options
                delegate: StatChip {
                    id: goalChip
                    required property int index
                    required property var modelData
                    compact: true
                    label: modelData.isCustom ? "+" : "●"
                    value: modelData.title
                    valueColor: goalField.text.trim().toLowerCase() === modelData.title.toLowerCase()
                        ? Theme.electricLime : Theme.cyberPurple
                    width: Math.min(implicitWidth, goalOptions.width)
                    interactive: true
                    KeyNavigation.tab: index + 1 < goalRepeater.count ? goalRepeater.itemAt(index + 1) : minutesField
                    KeyNavigation.backtab: index > 0 ? goalRepeater.itemAt(index - 1) : goalField
                    Accessible.name: modelData.isCustom ? "Add new goal" : "Select goal " + modelData.title
                    objectName: "goalChoice-" + (modelData.id || "custom")
                    onActivated: {
                        goalField.text = modelData.isCustom ? "" : modelData.title
                        goalField.forceActiveFocus()
                    }
                    onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(goalChip)

                }
            }
        }

        Text {
            width: parent.width
            visible: sheet.resolvedGoal !== null
            text: sheet.resolvedGoal && sheet.resolvedGoal.isExisting
                  ? "tied to goal: " + (sheet.resolvedGoal ? sheet.resolvedGoal.title : "") + "  (reused)"
                  : "will create goal: " + (sheet.resolvedGoal ? sheet.resolvedGoal.title : "")
            color: sheet.resolvedGoal && sheet.resolvedGoal.isExisting ? Theme.cyberPurple : Theme.electricLime
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }

        // ── MINUTES ─────────────────────────────────────────────
        Row {
            width: parent.width
            spacing: Theme.space(2)

            Text {
                text: "DAILY MINUTES"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                anchors.verticalCenter: parent.verticalCenter
            }

            Rectangle {
                id: minutesBox
                width: Theme.space(18)
                height: Theme.space(11)
                color: Theme.surfaceLowest
                border.color: minutesField.activeFocus ? Theme.coinGold : Theme.border
                border.width: minutesField.activeFocus ? 2 : 1

                TextInput {
                    id: minutesField
                    objectName: "commitmentMinutesInput"
                    anchors.fill: parent
                    anchors.margins: Theme.space(2)
                    verticalAlignment: TextInput.AlignVCenter
                    horizontalAlignment: TextInput.AlignRight
                    color: Theme.electricLime
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    text: "30"
                    clip: true
                    maximumLength: 4
                    activeFocusOnTab: true
                    onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(parent)
                    cursorVisible: activeFocus
                    inputMethodHints: Qt.ImhDigitsOnly
                    KeyNavigation.tab: nameField.text.trim() !== "" ? clearNameControl : clearMinutesControl
                    onTextEdited: sheet.errorText = ""
                    Keys.onReturnPressed: sheet.save()
                    Keys.onEnterPressed: sheet.save()
                }
            }
        }

        // inline validation / engine feedback — never a dialog
        Text {
            width: parent.width
            visible: sheet.errorText !== ""
            text: sheet.errorText
            color: Theme.bubblegum
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }

        Flow {
            width: parent.width
            spacing: Theme.space(1)
            visible: nameField.text.trim() !== "" || goalField.text.trim() !== "" || minutesField.text.trim() !== ""

            StatChip {
                id: clearNameControl
                visible: nameField.text.trim() !== ""
                compact: true; label: "NAME"; value: nameField.text.trim()
                valueColor: Theme.textPrimary
                width: Math.min(implicitWidth, parent.width)
                interactive: true
                KeyNavigation.tab: clearGoalControl.visible ? clearGoalControl : clearMinutesControl
                Accessible.name: "Clear commitment name"
                objectName: "clearNameButton"
                onActivated: sheet.clearName()
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(this)
            }
            StatChip {
                id: clearGoalControl
                visible: goalField.text.trim() !== ""
                compact: true; label: "GOAL"; value: goalField.text.trim()
                valueColor: Theme.cyberPurple
                width: Math.min(implicitWidth, parent.width)
                interactive: true
                KeyNavigation.tab: clearMinutesControl
                Accessible.name: "Clear selected goal"
                objectName: "clearGoalButton"
                onActivated: sheet.clearGoal()
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(this)
            }
            StatChip {
                id: clearMinutesControl
                visible: minutesField.text.trim() !== ""
                compact: true; label: "MIN"; value: minutesField.text.trim() + "m"
                valueColor: Theme.electricLime
                width: Math.min(implicitWidth, parent.width)
                interactive: true
                KeyNavigation.tab: saveButton
                Accessible.name: "Reset minutes to 30"
                objectName: "clearMinutesButton"
                onActivated: sheet.clearMinutes()
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(this)
            }

        }

        BevelButton {
            id: saveButton
            objectName: "saveCommitmentButton"
            enabled: !sheet.busy && sheet.store && sheet.store.recordingReady && !sheet.store.saving
            label: sheet.busy ? "SAVING…" : "▶ SAVE COMMITMENT"
            width: parent.width
            onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(saveButton)
            KeyNavigation.tab: sheet.closeControl
            onActivated: sheet.save()
        }
    }

    Component.onCompleted: nameField.forceActiveFocus()
}
