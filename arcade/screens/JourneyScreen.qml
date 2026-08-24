import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P2: JOURNEY — trajectory surface (full cockpit, stub data). Stat tiles,
// XP bar + level rule, ledger preview, thin insights (R5.2 fence), records.
// V4 binds progression for real; V8 adds export from here's data.
ArcadeScreen {
    id: root
    title: "JOURNEY"

    property var fixture: FixtureLoader.load()
    readonly property var lvl: fixture ? FixtureLoader.levelProgress(fixture) : { have: 0, need: 1 }

    // ── stat tiles — Flow so a narrow panel wraps instead of bleeding ──
    Flow {
        width: parent.width
        spacing: Theme.space(2)

        StatChip { label: "LV"; value: String(root.fixture.progression.level); valueColor: Theme.manaPurple }
        StatChip { label: "RANK"; value: root.fixture.progression.storyRank }
        StatChip { label: "MOMENTUM"; value: root.fixture.progression.momentum; valueColor: Theme.electricLime }
    }

    // ── XP to next level (real rule) ───────────────────────────
    // Deliberately terse (Mohamed, live pass 2026-08-24): one compact line;
    // the lifetime/season breakdown moves behind click/hover detail in a
    // later PR (noted on the V4 ticket).
    Column {
        width: parent.width
        spacing: 4

        SegmentedBar {
            width: parent.width - Theme.space(2)
            fraction: root.lvl.need > 0 ? Math.max(0, Math.min(1, root.lvl.have / root.lvl.need)) : 0
        }
        Text {
            width: parent.width
            text: "LV " + root.fixture.progression.level + " → "
                  + (root.fixture.progression.level + 1) + " · "
                  + Math.round(100 * root.lvl.have / Math.max(1, root.lvl.need)) + "%"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            elide: Text.ElideRight
        }
    }

    // ── XP ledger preview (R4.2 transparency) — full sheet in V4 ──
    ArcadeCard {
        width: parent.width
        ribbon: "XP LEDGER"
        ribbonColor: Theme.coinGold
        ribbonText: Theme.goldDeep

        Column {
            width: parent.width
            spacing: Theme.space(1)
            Repeater {
                model: root.fixture.progression.ledger.slice(0, 3)
                delegate: Row {
                    required property var modelData
                    width: parent.width
                    Text {
                        width: parent.width - 48
                        text: modelData.reason
                        color: Theme.textPrimary
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.typeBody
                        elide: Text.ElideRight
                    }
                    Text {
                        text: "+" + modelData.lifetimeDelta
                        color: Theme.electricLime
                        font.family: Theme.fontFamily
                        font.pixelSize: Theme.typeBody
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }
        }
    }

    // ── thin insights (R5.2: nothing deeper) ───────────────────
    ArcadeCard {
        width: parent.width
        ribbon: "THIS WEEK"
        Text {
            width: parent.width
            text: "6h 20m focused · best streak ×12 · "
                  + root.fixture.progression.dailyTargetMinutes + "m daily target"
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
    }

    // ── achievements strip (stub; deepening waits for V7+) ─────
    ArcadeCard {
        width: parent.width
        ribbon: "ACHIEVEMENTS · " + root.fixture.story.achievements.length
        ribbonColor: Theme.chromeYellow
        ribbonText: Theme.onYellow

        Flow {
            width: parent.width
            spacing: Theme.space(1)
            Repeater {
                model: root.fixture.story.achievements
                delegate: StatChip {
                    required property var modelData
                    compact: true
                    label: "★"
                    value: modelData.title
                    valueColor: Theme.chromeYellow
                }
            }
        }
    }
}
