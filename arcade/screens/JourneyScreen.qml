import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P2: JOURNEY — trajectory surface. Stat tiles + segmented XP bar +
// thin-insights row (R5.2: nothing deeper). Stub-fed; V4 binds progression.
ArcadeScreen {
    id: root
    title: "JOURNEY"

    property var fixture: FixtureLoader.load()

    Row {
        width: parent.width
        spacing: Theme.space(2)

        StatChip { label: "LV"; value: fixture ? String(fixture.progression.level) : "—" }
        StatChip { label: "RANK"; value: fixture ? fixture.progression.storyRank : "—" }
        StatChip { label: "MOMENTUM"; value: fixture ? fixture.progression.momentum : "—" }
    }

    Column {
        width: parent.width
        spacing: 4

        Text {
            text: fixture
                  ? "XP TO LEVEL " + (fixture.progression.level + 1) + " — "
                    + Math.round(100 * fixture.progression.toNextLevel.have
                                 / fixture.progression.toNextLevel.need) + "%"
                  : ""
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: 9
            font.letterSpacing: 2
        }

        SegmentedBar {
            fraction: fixture ? fixture.progression.toNextLevel.have / fixture.progression.toNextLevel.need : 0
        }
    }

    // thin insights (V4 scope fence)
    ArcadeCard {
        width: parent.width
        ribbon: "THIS WEEK"
        Text {
            width: parent.width
            text: "6h 20m focused · 3 streaks alive · 210 XP earned"
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: 12
            wrapMode: Text.WordWrap
        }
    }
}
