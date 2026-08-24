import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P8: RECOVERY — private surface behind the guard (full cockpit, stub data).
// Tracks with streaks + milestones, check-in / explicit relapse controls,
// new-track entry. Private-by-default copy everywhere (R4.4). V7 binds real
// RecoveryModel writes with privacy verified at write sites.
ArcadeScreen {
    id: root
    title: "RECOVERY"

    property var fixture: FixtureLoader.load()

    Text {
        width: parent.width
        text: "Private by default. Nothing here appears in stats,\nshare cards, or notifications."
        color: Theme.textMuted
        font.family: Theme.fontFamily
        font.pixelSize: Theme.typeBody
        lineHeight: 1.4
        wrapMode: Text.WordWrap
    }

    // ── tracks ──────────────────────────────────────────────────
    Repeater {
        model: root.fixture.recovery.tracks
        delegate: ArcadeCard {
            required property var modelData
            width: parent.width
            ribbon: (modelData.customCategory || modelData.category).toUpperCase()
                    + " · DAY " + trackStreak(modelData.id)
            ribbonColor: Theme.arcadeBlue
            ribbonText: Theme.onBlue

            Column {
                width: parent.width
                spacing: Theme.space(1)

                Text {
                    width: parent.width
                    text: "started " + modelData.startDate + " · private"
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    wrapMode: Text.WordWrap
                }

                Row {
                    spacing: Theme.space(2)

                    BevelButton { label: "+ CHECK IN"; baseColor: Theme.pixelGreen; textColor: Theme.greenDeep }
                    BevelButton {
                        label: "RELAPSE"
                        danger: true
                        // explicit relapse ends the attempt — no shame effects (R4.4)
                    }
                }
                Text {
                    width: parent.width
                    text: relapseNote()
                    color: Theme.textMuted
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeTiny
                    wrapMode: Text.WordWrap

                    function relapseNote() {
                        return "recording a relapse keeps earned XP and offers restart"
                    }
                }
            }

            function trackStreak(trackId) {
                for (var i = 0; i < root.fixture.recovery.attempts.length; i++) {
                    var a = root.fixture.recovery.attempts[i]
                    if (a.trackId === trackId) return a.currentStreakDays
                }
                return 0
            }
        }
    }

    // ── new track entry (the missing creation point) ────────────
    ArcadeCard {
        width: parent.width
        ribbon: "NEW TRACK"
        ribbonColor: Theme.manaPurple
        ribbonText: Theme.purpleSoft

        Column {
            width: parent.width
            spacing: Theme.space(1)

            Text {
                width: parent.width
                text: "Choose a category or name your own. Start now or backdate."
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
                wrapMode: Text.WordWrap
            }
            Flow {
                width: parent.width
                spacing: Theme.space(1)
                StatChip { compact: true; label: ""; value: "social media"; valueColor: Theme.cyberPurple }
                StatChip { compact: true; label: ""; value: "gaming"; valueColor: Theme.cyberPurple }
                StatChip { compact: true; label: ""; value: "custom…"; valueColor: Theme.textMuted }
            }
            BevelButton { label: "+ START TRACK"; width: parent.width - Theme.space(2) }
        }
    }
}
