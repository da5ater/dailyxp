import QtQuick
import "../"
import "../../EventModel.js" as EventModel
import "../../RoutineView.js" as RoutineView

ArcadeSheet {
    id: sheet
    title: "NEW ROUTINE"
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
            var routine = RoutineView.createRoutine({ title: nameField.text, minutes: minutesField.text,
                weekdays: weekdays }, EventModel.uuidV4(), store.sessionDailyXpDate(store.planningClock().toISOString()))
            pendingId = routine.id
            errorText = ""
            if (!store.applyPlanningCommand({ type: "routine.create", routine: routine })) {
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
                var routines = sheet.store.planningProjection.routines
                for (var i = 0; i < routines.length; i++) {
                    if (routines[i].id === sheet.pendingId) {
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
            text: "Name your routine and choose when it repeats."
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
                objectName: "routineNameInput"
                anchors.fill: parent
                anchors.margins: Theme.space(2)
                verticalAlignment: TextInput.AlignVCenter
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                maximumLength: 60
                clip: true
                activeFocusOnTab: true
                Accessible.name: "Routine name"
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
                    objectName: "routineWeekday" + (index + 1)
                    width: 44
                    compact: true
                    interactive: true
                    label: ""
                    value: modelData
                    valueColor: sheet.weekdays.indexOf(index + 1) >= 0 ? Theme.electricLime : Theme.textMuted
                    Accessible.name: modelData + (sheet.weekdays.indexOf(index + 1) >= 0 ? " selected" : " not selected")
                    KeyNavigation.tab: index === 6 ? minutesField : days.itemAt(index + 1)
                    onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(this)
                    onActivated: sheet.toggleDay(index + 1)
                }
            }
        }
        Row {
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
                    KeyNavigation.tab: saveButton
                    onTextEdited: sheet.errorText = ""
                    onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(parent)
                    Keys.onReturnPressed: sheet.save()
                }
            }
        }
        Text {
            objectName: "routineError"
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
            objectName: "saveRoutineButton"
            width: parent.width
            label: sheet.busy ? "SAVING…" : "SAVE ROUTINE"
            enabled: !sheet.busy && sheet.store && sheet.store.recordingReady && !sheet.store.saving
            KeyNavigation.tab: sheet.closeControl
            onActiveFocusChanged: if (activeFocus) sheet.ensureVisible(saveButton)
            onActivated: sheet.save()
        }
    }
    Component.onCompleted: nameField.forceActiveFocus()
}
