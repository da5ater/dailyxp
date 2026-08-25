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

    // V2 (#94): fixture loads ONLY when unbound (harness). The bound path
    // reads the real planningProjection — never both, never the form.
    readonly property var store: shellApi ? shellApi.stateStore : null
    readonly property bool bound: store !== null && store.planningProjection !== undefined
    readonly property var fixture: bound ? null : FixtureLoader.load()

    readonly property var todayList: bound
        ? []   // occurrences arrive with V5 routine generation
        : (fixture ? FixtureLoader.todays(fixture) : [])
    readonly property var taskList: bound ? (store.planningProjection.tasks || [])
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

    // ── selection + today rail ─────────────────────────────────
    ArcadeCard {
        visible: root.todayList.length > 0 || root.focusTask !== null
        emphasized: true                      // the signature card — one per surface
        width: parent.width
        ribbon: "TODAY · FOCUS"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep

        Text {
            width: parent.width
            text: root.todayList.length > 0
                  ? root.todayList[0].title
                  : (root.focusTask ? root.focusTask.title : "")
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
                var t = o ? null : root.focusTask
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
            enabled: false  // session start binds in V3 (#95)
            opacity: 0.55
        }
        Flow {
            width: parent.width
            spacing: Theme.space(2)
            Repeater {
                model: root.taskList
                delegate: StatChip {
                    id: chip
                    required property int index
                    required property var modelData
                    compact: true
                    label: chip.index === root.focusIndex ? "●" : "○"
                    value: modelData.title.length > 14
                           ? modelData.title.slice(0, 13) + "…" : modelData.title
                    valueColor: chip.index === root.focusIndex ? "#ffebc4" : Theme.textMuted
                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.selectedTaskIndex = chip.index
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

    // ── habit quick-strip (R4.3): every habit visible with streaks ──
    // V2 bound mode: hidden — habits bind in V6 (#98). Fixture keeps V1 read.
    // All fixture dereferences guard on habitCard.fx because QML evaluates
    // bindings even while the card is invisible (live error-log lesson).
    ArcadeCard {
        id: habitCard
        readonly property var fx: root.bound ? null : root.fixture
        visible: fx !== null && fx.habit.habits.length > 0
        width: parent.width
        ribbon: fx !== null
                ? "HABITS · " + fx.habit.dailySummaries["2026-08-24"].completedCount
                  + "/" + fx.habit.dailySummaries["2026-08-24"].scheduledCount
                : "HABITS"
        ribbonColor: Theme.powerGreen

        BevelButton {
            label: "+ ADD HABIT"
            baseColor: Theme.manaPurple
            textColor: Theme.purpleSoft
            width: parent.width
        }

        Column {
            width: parent.width
            spacing: Theme.space(2)

            Repeater {
                model: habitCard.fx !== null ? habitCard.fx.habit.habits : []
                delegate: Row {
                    required property var modelData
                    width: parent.width
                    spacing: Theme.space(2)

                    Rectangle {
                        id: checkCell
                        width: 22; height: 22
                        readonly property bool done: habitCard.fx !== null &&
                            FixtureLoader.habitDoneToday(habitCard.fx, modelData)
                        color: done ? Theme.powerGreen : Theme.surfaceLowest
                        border.color: done ? Theme.greenDeep : Theme.border
                        border.width: 1
                        Text {
                            anchors.centerIn: parent
                            text: checkCell.done ? "✔" : ""
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
                        text: "×" + (habitCard.fx !== null
                                     ? (habitCard.fx.habit.streaks[modelData.id] || 0) : 0)
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
