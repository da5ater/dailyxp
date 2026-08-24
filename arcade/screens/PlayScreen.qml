import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P1: PLAY — the dominant daily surface (full cockpit, stub data).
// Everything PLAY owns is present: selection chips, today rail, session
// start, Daily Target bar, habits with streaks, overdue placeholder,
// Recovery guarded entry. Real behavior lands serially V2–V7.
ArcadeScreen {
    id: root
    title: "PLAY"

    property var fixture: FixtureLoader.load()
    readonly property var todayList: fixture ? FixtureLoader.todays(fixture) : []
    readonly property var taskList: fixture ? fixture.planning.tasks : []
    readonly property bool hasAnyCommitments: fixture
        && (fixture.planning.tasks.length > 0 || fixture.planning.routines.length > 0
            || fixture.planning.occurrences.length > 0)

    // ── selection + today rail ─────────────────────────────────
    ArcadeCard {
        visible: root.todayList.length > 0 || root.taskList.length > 0
        emphasized: true                      // the signature card — one per surface
        width: parent.width
        ribbon: "TODAY · FOCUS"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep

        Text {
            width: parent.width
            text: root.todayList.length > 0
                  ? root.todayList[0].title
                  : (root.taskList.length > 0 ? root.taskList[0].title : "")
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTitle
            font.bold: true
            elide: Text.ElideRight
        }
        Text {
            width: parent.width
            text: {
                var o = root.todayList.length > 0 ? root.todayList[0] : null
                var t = o ? null : (root.taskList.length > 0 ? root.taskList[0] : null)
                if (o) return o.expectedMinutes + "m budget · " + o.primarySkill
                if (t) return t.estimateMinutes + "m estimate · " + t.primarySkill + " · one-shot"
                return ""
            }
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        BevelButton {
            label: "▶ START SESSION"
            width: parent.width - Theme.space(2)
            anchors.horizontalCenter: parent.horizontalCenter
            focus: true   // landing keyboard entry point (R8)
        }
        Flow {
            width: parent.width
            spacing: Theme.space(1)
            Repeater {
                model: root.taskList
                delegate: StatChip {
                    required property var modelData
                    compact: true
                    label: "○"
                    value: modelData.title.length > 14
                           ? modelData.title.slice(0, 13) + "…" : modelData.title
                    valueColor: Theme.textMuted
                }
            }
            StatChip { compact: true; label: "+"; value: "free"; valueColor: Theme.arcadeBlue }
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
            label: "+ SET FIRST COMMITMENT"
            width: parent.width - Theme.space(2)
            anchors.horizontalCenter: parent.horizontalCenter
        }
    }

    // ── daily target progress ───────────────────────────────────
    ArcadeCard {
        visible: root.hasAnyCommitments
        width: parent.width
        ribbon: "DAILY TARGET"
        ribbonColor: Theme.manaPurple
        ribbonText: Theme.purpleSoft

        SegmentedBar {
            blocks: 20
            width: parent.width - Theme.space(4)
            fraction: Math.min(1, (root.fixture.session.focusedMilliseconds / 60000)
                                 / root.fixture.progression.dailyTargetMinutes)
            fill: Theme.manaPurple
            fillBorder: Theme.purpleDeep
        }
        Text {
            width: parent.width
            text: FixtureLoader.hhmm(root.fixture.session.focusedMilliseconds)
                  + " focused of " + root.fixture.progression.dailyTargetMinutes
                  + "m target today"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
    }

    // ── habit quick-strip (R4.3): every habit visible with streaks ──
    ArcadeCard {
        visible: root.fixture.habit.habits.length > 0
        width: parent.width
        ribbon: "HABITS · "
                + root.fixture.habit.dailySummaries["2026-08-24"].completedCount
                + "/" + root.fixture.habit.dailySummaries["2026-08-24"].scheduledCount
        ribbonColor: Theme.powerGreen

        BevelButton {
            label: "+ ADD HABIT"
            baseColor: Theme.manaPurple
            textColor: Theme.purpleSoft
            width: parent.width
        }

        Column {
            width: parent.width
            spacing: Theme.space(1)

            Repeater {
                model: root.fixture.habit.habits
                delegate: Row {
                    required property var modelData
                    width: parent.width
                    spacing: Theme.space(1)

                    Rectangle {
                        id: checkCell
                        width: 22; height: 22
                        color: FixtureLoader.habitDoneToday(root.fixture, modelData)
                               ? Theme.powerGreen : Theme.surfaceLowest
                        border.color: FixtureLoader.habitDoneToday(root.fixture, modelData)
                                      ? Theme.greenDeep : Theme.border
                        border.width: 1
                        Text {
                            anchors.centerIn: parent
                            text: FixtureLoader.habitDoneToday(root.fixture, modelData) ? "✔" : ""
                            color: Theme.greenDeep
                            font.pixelSize: Theme.typeBody
                        }
                        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor }
                    }
                    Text {
                        text: modelData.title
                        color: Theme.textPrimary
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.typeBody
                        elide: Text.ElideRight
                        width: parent.width - checkCell.width - Theme.space(8)
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Text {
                        text: "×" + (root.fixture.habit.streaks[modelData.id] || 0)
                        color: Theme.chromeYellow
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.typeTiny
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }
        }
    }

    // ── overdue micro-strip placeholder — real rule lands in V6 ──
    ArcadeCard {
        visible: false
        width: parent.width
        ribbon: "YESTERDAY"
    }

    // ── recovery guarded entry (R4.4) ───────────────────────────
    Row {
        width: parent.width
        spacing: Theme.space(2)

        BevelButton {
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
            width: parent.width - Theme.space(28)
            wrapMode: Text.WordWrap
        }
    }
}
