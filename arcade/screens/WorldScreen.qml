import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P3: WORLD — light kingdom motif (full cockpit, stub data). Provinces with
// landmarks, Momentum banner, antagonist cause-lines, achievements live in
// Journey. R5.1 boundary: no resource-management mechanics. V7 binds story.
ArcadeScreen {
    id: root
    title: "WORLD"

    property var fixture: FixtureLoader.load()

    // ── momentum banner ────────────────────────────────────────
    ArcadeCard {
        width: parent.width
        ribbon: "MOMENTUM"
        ribbonColor: Theme.manaPurple
        ribbonText: Theme.purpleSoft

        Text {
            width: parent.width
            text: root.fixture.story.momentum + " — steady work, steady kingdom."
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        SegmentedBar {
            visible: false  // momentum meter arrives with the V7 bind
            blocks: 20
        }
    }

    // ── provinces (goal-as-territory, exact provinceForGoal shape) ──
    Repeater {
        model: root.fixture.story.provinces
        delegate: ArcadeCard {
            required property var modelData
            width: parent.width
            ribbon: String(modelData.title).toUpperCase()
            ribbonColor: modelData.status === "active" ? Theme.powerGreen : Theme.textMuted

            Column {
                width: parent.width
                spacing: Theme.space(1)

                Text {
                    width: parent.width
                    text: modelData.status === "achieved" ? "reclaimed — visitable"
                        : modelData.status === "sleeping" ? "sleeping"
                        : modelData.status === "ruins" ? "ruins — reclaimable"
                        : "active — rebuilds as milestones land"
                    color: Theme.textPrimary
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    wrapMode: Text.WordWrap
                }

                // landmarks under their province
                Repeater {
                    model: root.fixture.story.landmarks.filter(
                               function(l){ return l.provinceId === modelData.id })
                    delegate: Row {
                        required property var modelData
                        spacing: Theme.space(1)
                        Text {
                            text: modelData.achieved ? "[★]" : "[·]"
                            color: modelData.achieved ? Theme.chromeYellow : Theme.textMuted
                            font.pixelSize: Theme.typeBody
                        }
                        Text {
                            text: modelData.title
                            color: Theme.textMuted
                            font.family: Theme.fontFamily
                            font.pixelSize: Theme.typeBody
                        }
                    }
                }
            }
        }
    }

    // ── antagonist cause-lines (never insult; V7 binds for real) ──
    ArcadeCard {
        visible: root.fixture.story.antagonists.length > 0
        width: parent.width
        ribbon: "THE HOLLOW KING"
        ribbonColor: Theme.bubblegum
        ribbonText: "#4a1030"

        Column {
            width: parent.width
            spacing: Theme.space(1)
            Repeater {
                model: root.fixture.story.antagonists
                delegate: Text {
                    required property var modelData
                    width: parent.width
                    text: "· " + modelData.causeLine
                    color: Theme.textPrimary
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeBody
                    wrapMode: Text.WordWrap
                }
            }
        }
    }
}
