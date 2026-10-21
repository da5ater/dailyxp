pragma ComponentBehavior: Bound
import QtQuick
import "../"
import "../../EventModel.js" as EventModel
import "../../RoutineView.js" as RoutineView
import "../../HabitView.js" as HabitView

ArcadeSheet {
    id: sheet
    property string entryKind: "routine"
    readonly property bool isHabit: entryKind === "habit"
    property bool carryover: false
    title: isHabit ? "NEW HABIT" : "NEW ROUTINE"
    property var shellApi: null
    readonly property var store: shellApi ? shellApi.stateStore : null
    property var weekdays: [1, 2, 3, 4, 5, 6, 7]
    property string pendingId: ""
    property string errorText: ""
    readonly property bool busy: pendingId !== ""
    dismissEnabled: !busy
    initialFocusItem: nameField

    function toggleDay(day) {
        var next = weekdays.slice()
        var index = next.indexOf(day)
        if (index < 0) next.push(day)
        else next.splice(index, 1)
        weekdays = next
        errorText = ""
    }
    function save() {
        if (busy || !store || !store.ready || !store.recordingReady || store.saving) return
        try {
            var today = store.sessionDailyXpDate(store.planningClock().toISOString())
            var draft = { title: nameField.text, minutes: minutesField.text, weekdays: weekdays, carryover: carryover }
            var entity = isHabit ? HabitView.createHabit(draft, EventModel.uuidV4(), today)
                                 : RoutineView.createRoutine(draft, EventModel.uuidV4(), today)
            pendingId = entity.id
            errorText = ""
            var accepted = isHabit ? store.applyHabitCommand({ type: "habit.create", habit: entity })
                                   : store.applyPlanningCommand({ type: "routine.create", routine: entity })
            if (!accepted) {
                pendingId = ""
                errorText = store.errorMessage || "COULD NOT SAVE"
            }
        } catch (error) { errorText = String(error.message || error) }
    }
    Connections {
        target: sheet.store
        function onPersisted() {
            if (!sheet.busy) return
            Qt.callLater(function() {
                if (!sheet.busy || sheet.store.saving) return
                var entities = sheet.isHabit ? sheet.store.habitProjection.habits : sheet.store.planningProjection.routines
                for (var i = 0; i < entities.length; i++) {
                    if (entities[i].id === sheet.pendingId) {
                        sheet.pendingId = ""
                        sheet.dismissed()
                        return
                    }
                }
            })
        }
        function onErrorMessageChanged() {
            if (sheet.busy && sheet.store.errorMessage !== "") {
                sheet.pendingId = ""
                sheet.errorText = sheet.store.errorMessage
            }
        }
    }
    Column {
        width: parent.width
        spacing: Theme.space(3)
        enabled: !sheet.busy
        Text {
            width: parent.width
            text: sheet.isHabit ? "Name a habit and choose its days. Check it off on PLAY." : "Name your routine and choose when it repeats."
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            lineHeight: 1.4
            wrapMode: Text.WordWrap
        }
        Rectangle {
            width: parent.width
            height: 44
            color: Theme.surfaceLowest
            border.color: nameField.activeFocus ? Theme.coinGold : Theme.border
            border.width: 2
            TextInput {
                id: nameField
                objectName: sheet.isHabit ? "habitNameInput" : "routineNameInput"
                anchors.fill: parent
                anchors.margins: Theme.space(2)
                verticalAlignment: TextInput.AlignVCenter
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                maximumLength: 60
                clip: true
                activeFocusOnTab: true
                Accessible.name: sheet.isHabit ? "Habit name" : "Routine name"
                KeyNavigation.tab: days.itemAt(0)
                onTextEdited: sheet.errorText = ""
                onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(parent)
            }
        }
        Text {
            text: "REPEAT ON"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
        }
        Flow {
            width: parent.width
            spacing: Theme.space(2)
            Repeater {
                id: days
                model: RoutineView.WEEKDAYS
                delegate: StatChip {
                    required property int index
                    required property string modelData
                    objectName: (sheet.isHabit ? "habitWeekday" : "routineWeekday") + (index + 1)
                    width: 44
                    compact: true
                    interactive: true
                    label: ""
                    value: modelData
                    valueColor: sheet.weekdays.indexOf(index + 1) >= 0 ? Theme.electricLime : Theme.textMuted
                    Accessible.name: modelData + (sheet.weekdays.indexOf(index + 1) >= 0 ? " selected" : " not selected")
                    KeyNavigation.tab: index === 6 ? (sheet.isHabit ? saveButton : minutesField) : days.itemAt(index + 1)
                    onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(this)
                    onActivated: sheet.toggleDay(index + 1)
                }
            }
        }
        Row {
            visible: !sheet.isHabit
            width: parent.width
            spacing: Theme.space(2)
            Text {
                width: Math.max(60, parent.width - minutesBox.width - parent.spacing)
                text: "DAILY MINUTES"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                lineHeight: 1.4
            wrapMode: Text.WordWrap
                anchors.verticalCenter: parent.verticalCenter
            }
            Rectangle {
                id: minutesBox
                width: 72
                height: 44
                color: Theme.surfaceLowest
                border.color: minutesField.activeFocus ? Theme.coinGold : Theme.border
                border.width: 2
                TextInput {
                    id: minutesField
                    objectName: "routineMinutesInput"
                    text: "120"
                    anchors.fill: parent
                    anchors.margins: Theme.space(2)
                    color: Theme.electricLime
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    verticalAlignment: TextInput.AlignVCenter
                    horizontalAlignment: TextInput.AlignHCenter
                    clip: true
                    maximumLength: 4
                    activeFocusOnTab: true
                    Accessible.name: "Daily minutes"
                    KeyNavigation.tab: carryoverToggle
                    onTextEdited: sheet.errorText = ""
                    onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(parent)
                    Keys.onReturnPressed: sheet.save()
                }
            }
        }
        StatChip {
            id: carryoverToggle
            objectName: "routineCarryoverToggle"
            visible: !sheet.isHabit
            width: parent.width
            compact: true
            interactive: true
            label: "CARRY MISSED WORK"
            value: sheet.carryover ? "ON" : "OFF"
            valueColor: sheet.carryover ? Theme.electricLime : Theme.textMuted
            Accessible.name: "Carry missed routine work " + (sheet.carryover ? "on" : "off")
            KeyNavigation.tab: saveButton
            onActivated: sheet.carryover = !sheet.carryover
            onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(this)
        }
        Text {
            visible: !sheet.isHabit
            width: parent.width
            text: "ON keeps missed work for one gentle suggestion the next day. OFF lets it go."
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTiny
            wrapMode: Text.WordWrap
        }
        Text {
            objectName: sheet.isHabit ? "habitError" : "routineError"
            width: parent.width
            visible: sheet.errorText !== ""
            text: sheet.errorText
            color: Theme.chromeYellow
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            lineHeight: 1.4
            wrapMode: Text.WordWrap
        }
        BevelButton {
            id: saveButton
            objectName: sheet.isHabit ? "saveHabitButton" : "saveRoutineButton"
            width: parent.width
            label: sheet.busy ? "SAVING…" : sheet.isHabit ? "SAVE HABIT" : "SAVE ROUTINE"
            enabled: !sheet.busy && sheet.store && sheet.store.recordingReady && !sheet.store.saving
            KeyNavigation.tab: sheet.closeControl
            onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(saveButton)
            onActivated: sheet.save()
        }
    }
    Component.onCompleted: nameField.forceActiveFocus()
}
