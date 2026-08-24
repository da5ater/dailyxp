import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P4: SETUP — editorial surface (full cockpit, stub data). Everything
// configuration lives here so it never forces traversal of experiential
// screens (R5/R7). V5 binds routines; V8 binds settings/export.
ArcadeScreen {
    id: root
    title: "SETUP"

    property var fixture: FixtureLoader.load()

    // ── routines ────────────────────────────────────────────────
    ArcadeCard {
        width: parent.width
        ribbon: "ROUTINES · " + root.fixture.planning.routines.length
        Text {
            width: parent.width
            text: root.fixture.planning.routines.length > 0
                  ? root.fixture.planning.routines[0].title + " · "
                    + root.fixture.planning.routines[0].expectedMinutes + "m weekdays"
                  : "none yet — create your first routine"
            color: Theme.textPrimary
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            wrapMode: Text.WordWrap
        }
        BevelButton { label: "+ NEW ROUTINE"; width: parent.width - Theme.space(2) }
    }

    // ── one-shot tasks ──────────────────────────────────────────
    ArcadeCard {
        width: parent.width
        ribbon: "TASKS · " + root.fixture.planning.tasks.length
        Column {
            width: parent.width
            spacing: Theme.space(1)
            Repeater {
                model: root.fixture.planning.tasks
                delegate: Row {
                    required property var modelData
                    width: parent.width
                    spacing: Theme.space(1)
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
            spacing: Theme.space(1)
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
            spacing: Theme.space(1)
            Text {
                width: parent.width
                text: "Day boundary · 04:00   (editable in V8)"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
            }
            Text {
                width: parent.width
                text: "Reduced motion · off     (toggle lands in V8)"
                color: Theme.textPrimary
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeBody
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
