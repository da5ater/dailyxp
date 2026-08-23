import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P1: PLAY — the default landing. Minimal first open (R13/R5): one rail card
// + START, habit strip, and (V2) the first-commitment empty state. Stub-fed
// via FixtureLoader for V1; V2/V3/V6 replace sources per-domain.
ArcadeScreen {
    id: root
    title: "PLAY"

    property var fixture: FixtureLoader.load()

    // ── today rail ──────────────────────────────────────────────
    ArcadeCard {
        visible: fixture && fixture.planning.todayOccurrences.length > 0
        width: parent.width
        ribbon: "TODAY · FOCUS"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep

        Text {
            width: parent.width
            text: fixture && fixture.planning.todayOccurrences.length > 0
                  ? fixture.planning.todayOccurrences[0].title : ""
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: 16
            font.bold: true
            elide: Text.ElideRight
        }
        Text {
            width: parent.width
            text: fixture && fixture.planning.todayOccurrences.length > 0
                  ? fixture.planning.todayOccurrences[0].budgetLabel : ""
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: 11
            wrapMode: Text.WordWrap
        }
        BevelButton {
            label: "▶ START SESSION"
            width: parent.width - Theme.space(2)
            anchors.horizontalCenter: parent.horizontalCenter
            focus: true   // landing keyboard entry point (R8)
        }
    }

    // ── V2 empty state ──────────────────────────────────────────
    ArcadeCard {
        visible: fixture && fixture.planning.todayOccurrences.length === 0
                 && fixture.planning.commitments.length === 0
        width: parent.width
        ribbon: "NEW DAY"
        ribbonColor: Theme.powerGreen

        Text {
            width: parent.width
            text: "Set your first commitment.\nName it, give it a daily time budget — then press start."
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: 13
            lineHeight: 1.4
            wrapMode: Text.WordWrap
        }
        BevelButton {
            label: "+ SET FIRST COMMITMENT"
            width: parent.width - Theme.space(2)
            anchors.horizontalCenter: parent.horizontalCenter
        }
    }

    // ── habit quick-strip (R4.3) ────────────────────────────────
    Row {
        visible: fixture && fixture.habit.habits.length > 0
        width: parent.width
        spacing: Theme.space(2)

        Repeater {
            model: fixture ? fixture.habit.habits : []
            delegate: StatChip {
                required property var modelData
                compact: true
                label: modelData.doneToday ? "✔" : "○"
                value: modelData.name
                valueColor: modelData.doneToday ? Theme.powerGreen : Theme.textPrimary
            }
        }
    }
}
