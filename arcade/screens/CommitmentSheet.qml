import QtQuick
import "../"
import "../../EventModel.js" as EventModel

// P5: COMMITMENT SHEET (V2, #94) — the first real-engine write path.
// SAVE issues PlanningModel.decide(task.create) through the host store;
// AgDR-0003 records why a commitment is a standalone Task. Validation
// mirrors the engine locally so bad input never reaches decide().
//
// Keyboard (R8): opens with NAME focused; Tab walks NAME → MINUTES → SAVE;
// Esc anywhere dismisses (ArcadeSheet).
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
        var ok = store.applyPlanningCommand({
            type: "task.create",
            task: {
                id: EventModel.uuidV4(),
                title: nameField.text.trim(),
                estimateMinutes: minutes,
                urgency: "normal",
                deadline: null,
                primarySkill: "general/focus",
                goalId: null,
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
                KeyNavigation.tab: minutesField
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
