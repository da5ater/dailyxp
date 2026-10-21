pragma ComponentBehavior: Bound
import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader
import "../../RoutineView.js" as RoutineView

// P4: SETUP — editorial surface (full cockpit, stub data). Everything
// configuration lives here so it never forces traversal of experiential
// screens (R5/R7). V5 binds routines; V8 binds settings/export.
ArcadeScreen {
    id: root
    title: "SETUP"

    property var fixture: FixtureLoader.load()
    readonly property var store: shellApi ? shellApi.stateStore : null
    readonly property var routines: store ? store.planningProjection.routines : []
    readonly property var tasks: store ? store.planningProjection.tasks : []
    function focusRoutineControl() { newRoutineButton.forceActiveFocus() }

    ArcadeCard {
        width: parent.width
        ribbon: "ROUTINES · " + root.routines.length
        Column {
            width: parent.width
            spacing: Theme.space(3)
            Text {
                visible: root.routines.length === 0
                width: parent.width
                text: "No routines yet. Create your first routine."
                color: Theme.textMuted
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                wrapMode: Text.WordWrap
            }
            Repeater {
                model: root.routines
                delegate: Column {
                    id: routineRow
                    required property var modelData
                    required property int index
                    width: parent.width
                    spacing: Theme.space(2)
                    Text {
                        objectName: "setupRoutine" + routineRow.index
                        width: parent.width
                        text: routineRow.modelData.title + " · " + routineRow.modelData.expectedMinutes + "m\n" + RoutineView.scheduleLabel(routineRow.modelData)
                        color: Theme.textPrimary
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.typeBody
                        lineHeight: 1.4
                        wrapMode: Text.WrapAnywhere
                    }
                    StatChip {
                        objectName: "setupCarryover" + routineRow.index
                        width: parent.width
                        compact: true
                        interactive: true
                        label: "CARRY MISSED WORK"
                        value: routineRow.modelData.carryover ? "ON" : "OFF"
                        valueColor: routineRow.modelData.carryover ? Theme.electricLime : Theme.textMuted
                        enabled: root.store && root.store.ready && root.store.recordingReady && !root.store.saving
                        Accessible.name: routineRow.modelData.title + ", carry missed work " + value
                        onActiveFocusChanged: if (activeFocus && root.shellApi) root.shellApi.revealControl(this)
                        onActivated: root.store.applyPlanningCommand({ type: "routine.edit", id: routineRow.modelData.id,
                            scope: "today_and_future", dailyXpDate: root.store.planningProjection.lastAdvancedDailyXpDate,
                            changes: { carryover: !routineRow.modelData.carryover } })
                    }
                }
            }
            BevelButton {
                id: newRoutineButton
                objectName: "newRoutineButton"
                width: parent.width
                label: "+ NEW ROUTINE"
                enabled: root.store && root.store.ready && root.store.recordingReady && !root.store.saving
                onActivated: root.shellApi.openRecurringSheet()
            }
        }
    }

    // ── one-shot tasks ──────────────────────────────────────────
    ArcadeCard {
        width: parent.width
        ribbon: "TASKS · " + root.tasks.length
        Column {
            width: parent.width
            spacing: Theme.space(2)
            Repeater {
                model: root.tasks
                delegate: Row {
                    required property var modelData
                    width: parent.width
                    spacing: Theme.space(2)
                    Text { text: "·"; color: Theme.arcadeBlue; font.pixelSize: Theme.typeBody }
                    Text {
                        width: parent.width - Theme.space(3)
                        text: modelData.title + " (" + modelData.estimateMinutes + "m)"
                        color: Theme.textPrimary
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.typeBody
                        elide: Text.ElideRight
                    }
                }
            }
        }
        BevelButton { label: "+ NEW TASK"; width: parent.width - Theme.space(2) }
    }

    // ── skills taxonomy (stub — no slice owns it yet; listed for shape) ──
    ArcadeCard {
        width: parent.width
        ribbon: "SKILLS"
        Flow {
            width: parent.width
            spacing: Theme.space(2)
            StatChip { compact: true; label: ""; value: "backend/ruby"; valueColor: Theme.cyberPurple }
            StatChip { compact: true; label: ""; value: "writing/arch"; valueColor: Theme.cyberPurple }
            StatChip { compact: true; label: "+"; value: "add"; valueColor: Theme.textMuted }
        }
    }

    // ── settings ────────────────────────────────────────────────
    ArcadeCard {
        width: parent.width
        ribbon: "SETTINGS"
        Column {
            width: parent.width
            spacing: Theme.space(2)
            Text {
                width: parent.width
                text: "Day boundary · 04:00   (editable in V8)"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                elide: Text.ElideRight
            }
            Text {
                width: parent.width
                text: "Reduced motion · off     (toggle lands in V8)"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                elide: Text.ElideRight
            }
            Text {
                width: parent.width
                text: "Export JSON · reset data   (arrive in V8)"
                color: Theme.textMuted
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                wrapMode: Text.WordWrap
            }
        }
    }
}
