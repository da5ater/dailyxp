import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P1: PLAY — the default landing. Minimal first open (R13/R5): one rail card
// + START, habit quick-strip, and (V2) the first-commitment empty state.
// Stub-fed via FixtureLoader for V1; V2/V3/V6 replace sources per-domain.
ArcadeScreen {
    id: root
    title: "PLAY"

    property var fixture: FixtureLoader.load()
    readonly property var todayList: fixture ? FixtureLoader.todays(fixture) : []
    readonly property bool hasAnyCommitments: fixture
        && (fixture.planning.tasks.length > 0 || fixture.planning.routines.length > 0
            || fixture.planning.occurrences.length > 0)

    // ── today rail ──────────────────────────────────────────────
    ArcadeCard {
        visible: root.todayList.length > 0
        width: parent.width
        ribbon: "TODAY · FOCUS"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep

        Text {
            width: parent.width
            text: root.todayList.length > 0 ? root.todayList[0].title : ""
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: 16
            font.bold: true
            elide: Text.ElideRight
        }
        Text {
            width: parent.width
            text: root.todayList.length > 0
                  ? root.todayList[0].expectedMinutes + "m budget · "
                    + root.todayList[0].primarySkill : ""
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
        visible: !root.hasAnyCommitments
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

    // ── overdue micro-strip placeholder — real rule lands in V6 ──
    ArcadeCard {
        visible: false  // enabled in V6 with the single-gentle-suggestion rule
        width: parent.width
        ribbon: "YESTERDAY"
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
                label: FixtureLoader.habitDoneToday(root.fixture, modelData) ? "✔" : "○"
                value: modelData.title
                valueColor: FixtureLoader.habitDoneToday(root.fixture, modelData)
                            ? Theme.powerGreen : Theme.textPrimary
            }
        }
    }
}
