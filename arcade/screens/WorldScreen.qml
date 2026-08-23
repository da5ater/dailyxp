import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P3: WORLD — light kingdom motif only (R5.1). Province cards mirror goal
// progress; Momentum banner; Hollow King cause-line when idle. No fixtures,
// no leagues (competition out of phase). Stub-fed; V7 binds story.
ArcadeScreen {
    id: root
    title: "WORLD"

    property var fixture: FixtureLoader.load()

    ArcadeCard {
        width: parent.width
        ribbon: "MOMENTUM"
        ribbonColor: Theme.manaPurple
        ribbonText: Theme.purpleSoft

        Text {
            width: parent.width
            text: fixture ? fixture.story.momentum + " — steady work, steady kingdom." : ""
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: 13
            wrapMode: Text.WordWrap
        }
    }

    Repeater {
        model: fixture ? fixture.story.provinces : []
        delegate: ArcadeCard {
            required property var modelData
            width: parent.width
            ribbon: modelData.name.toUpperCase()
            ribbonColor: modelData.status === "active" ? Theme.powerGreen : Theme.textMuted

            Text {
                width: parent.width
                text: modelData.status === "achieved" ? "reclaimed — visitable"
                    : modelData.status === "sleeping" ? "sleeping"
                    : modelData.status === "ruins" ? "ruins — reclaimable"
                    : Math.round(modelData.fillFraction * 100) + "% rebuilt"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: 12
                wrapMode: Text.WordWrap
            }
            SegmentedBar {
                visible: modelData.status === "active"
                blocks: 20
                width: parent.width - Theme.space(2)
                fraction: modelData.fillFraction
                fill: Theme.powerGreen
                fillBorder: Theme.greenDeep
            }
        }
    }
}
