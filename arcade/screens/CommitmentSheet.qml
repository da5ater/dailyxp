import QtQuick
import "../"
import "../../EventModel.js" as EventModel

// P5: COMMITMENT SHEET (V2, #94) — the first real-engine write path.
// SAVE issues PlanningModel.decide(task.create) through the host store;
// AgDR-0003 records why a commitment is a standalone Task. Validation
// mirrors the engine locally so bad input never reaches decide().
//
// Keyboard (R8): opens with NAME focused; Tab walks NAME → GOAL → MINUTES
// → SAVE; Esc anywhere dismisses (ArcadeSheet).
ArcadeSheet {
    id: sheet
    title: "NEW COMMITMENT"

    // host handle — ShellContent injects itself; .stateStore carries the
    // real engine (StateStore in production, store-alike in the harness)
    property var shellApi: null
    readonly property var store: shellApi ? shellApi.stateStore : null

    property string errorText: ""
    readonly property bool formValid:
        nameField.text.trim().length > 0 &&
        minutesField.text.trim() !== "" &&
        Number.isInteger(parseInt(minutesField.text, 10)) &&
        parseInt(minutesField.text, 10) >= 1 &&
        parseInt(minutesField.text, 10) <= 1440

    function save() {
        errorText = ""
        if (nameField.text.trim().length === 0) { errorText = "NAME IT FIRST"; return }
        var minutes = parseInt(minutesField.text, 10)
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
            errorText = "MINUTES MUST BE 1–1440"
            return
        }
        if (!store || typeof store.applyPlanningCommand !== "function") {
            errorText = "ENGINE OFFLINE"
            return
        }

        // optional goal: find-or-create, then link (#94 live pass — empty
        // goal keeps the standalone one-shot Task; named goal gives it a
        // direction). reason is engine-required; stamped as provenance.
        var goalId = null
        var goalName = goalField.text.trim()
        if (goalName !== "") {
            var existing = store.planningProjection.goals.filter(function(g) {
                return g.title.toLowerCase() === goalName.toLowerCase() })
            if (existing.length > 0) {
                goalId = existing[0].id
            } else {
                goalId = EventModel.uuidV4()
                if (!store.applyPlanningCommand({
                        type: "goal.create",
                        goal: { id: goalId, title: goalName, primarySkill: "general/focus",
                                reason: "created from Commitment Sheet" }}))
                    { errorText = "GOAL SAVE FAILED"; return }
            }
        }

        var ok = store.applyPlanningCommand({
            type: "task.create",
            task: {
                id: EventModel.uuidV4(),
                title: nameField.text.trim(),
                estimateMinutes: minutes,
                urgency: "normal",
                deadline: null,
                primarySkill: "general/focus",
                goalId: goalId,
                milestoneId: null
            }
        })
        if (!ok) {
            errorText = "COULD NOT SAVE"
            return
        }
        sheet.dismissed()
    }

    Column {
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
                cursorVisible: activeFocus
                KeyNavigation.tab: minutesField
                onTextChanged: goalOptions.forceRecompute()

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
                list.push({ id: null, title: "+ ADD GOAL", isCustom: true })
                return list
            }
            function forceRecompute() { /* recompute on keystroke */ }

            Repeater {
                model: goalOptions.options
                delegate: StatChip {
                    id: goalChip
                    required property var modelData
                    compact: true
                    label: modelData.isCustom ? "+" : "●"
                    value: modelData.title
                    valueColor: goalField.text.trim().toLowerCase() === modelData.title.toLowerCase()
                        ? Theme.electricLime : Theme.cyberPurple
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (modelData.isCustom) {
                                goalField.text = ""
                                goalField.forceActiveFocus()
                            } else {
                                goalField.text = goalChip.modelData.title
                                goalField.forceActiveFocus()
                            }
                        }
                    }
                }
            }
        }

        // dedicated goal-feedback block: live confirmation that this
        // commitment will be tied to a direction. Shows the resolved goal
        // (existing reuse or the new name) so the user gets feedback before
        // pressing SAVE. Empty field → no direction (standalone one-shot).
        readonly property var chosenGoalTitle: goalField.text.trim()
        readonly property var resolvedGoal: {
            if (chosenGoalTitle === "") return null
            if (!store) return { title: chosenGoalTitle, isExisting: false }
            var gs = store.planningProjection.goals || []
            for (var i = 0; i < gs.length; i++)
                if (gs[i].title.toLowerCase() === chosenGoalTitle.toLowerCase())
                    return { title: gs[i].title, isExisting: true }
            return { title: chosenGoalTitle, isExisting: false }
        }
        Text {
            width: parent.width
            visible: resolvedGoal !== null
            text: resolvedGoal.isExisting
                  ? "tied to goal: " + resolvedGoal.title + "  (reused)"
                  : "will create goal: " + resolvedGoal.title
            color: resolvedGoal.isExisting ? Theme.cyberPurple : Theme.electricLime
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
                    cursorVisible: activeFocus
                    inputMethodHints: Qt.ImhDigitsOnly
                    KeyNavigation.tab: saveButton
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

        // ── SUMMARY BADGES (removable) ─────────────────────────────
        // Live read of the commitment being built: name, goal (if set),
        // minutes — each a chip with a red ✕ that clears that field.
        // Goal chips reuse the picker's resolved title; selecting a goal
        // option (or typing) fills the field, which makes its badge appear.
        Flow {
            width: parent.width
            spacing: Theme.space(1)
            visible: nameField.text.trim() !== "" || goalField.text.trim() !== "" || minutesField.text.trim() !== ""
            function clearName() { nameField.text = ""; nameField.forceActiveFocus() }
            function clearGoal() { goalField.text = ""; goalField.forceActiveFocus() }
            function clearMinutes() { minutesField.text = "30"; minutesField.forceActiveFocus() }

            StatChip {
                visible: nameField.text.trim() !== ""
                compact: true; label: "NAME"; value: nameField.text.trim()
                valueColor: Theme.textPrimary
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: parent.clearName() }
            }
            StatChip {
                visible: goalField.text.trim() !== ""
                compact: true; label: "GOAL"; value: goalField.text.trim()
                valueColor: Theme.cyberPurple
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: parent.clearGoal() }
            }
            StatChip {
                visible: minutesField.text.trim() !== ""
                compact: true; label: "MIN"; value: minutesField.text.trim() + "m"
                valueColor: Theme.electricLime
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: parent.clearMinutes() }
            }
            // red ✕ clears whichever field is set (goal-first, then name)
            Rectangle {
                id: clr
                visible: nameField.text.trim() !== "" || goalField.text.trim() !== ""
                width: 22; height: 22; radius: 11
                color: clrMouse.containsMouse ? "#ff3b5c" : Theme.surfaceLow
                border.color: Theme.border; border.width: 1
                Text { anchors.centerIn: parent; text: "✕"; color: "#ff3b5c"
                       font.family: Theme.fontFamily; font.pixelSize: Theme.typeBody }
                MouseArea {
                    id: clrMouse; anchors.fill: parent; hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: { if (goalField.text.trim() !== "") parent.clearGoal(); else parent.clearName() }
                }
            }
        }

        BevelButton {
            id: saveButton
            label: "▶ SAVE COMMITMENT"
            width: parent.width
            focus: true
            KeyNavigation.tab: nameField
            onActivated: sheet.save()
        }
    }

    Component.onCompleted: nameField.forceActiveFocus()
}
