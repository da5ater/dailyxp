import QtQuick
import "../"
import "../../FixtureLoader.js" as FixtureLoader

// P4: SETUP — editorial surface. Everything configuration lives here so it
// never forces traversal of experiential screens (R5/R7). Stub rows; V5
// binds routines, V8 binds settings/export.
ArcadeScreen {
    id: root
    title: "SETUP"

    ArcadeCard {
        width: parent.width
        ribbon: "ROUTINES"
        Text {
            width: parent.width
            text: "+ New routine (V5)"
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: 12
        }
    }

    ArcadeCard {
        width: parent.width
        ribbon: "SETTINGS"
        Column {
            width: parent.width
            spacing: Theme.space(2)

            Text {
                text: "Day boundary · reduced motion · export (V8)"
                color: Theme.textMuted
                font.family: Theme.fontFamily
                font.pixelSize: 12
                wrapMode: Text.WordWrap
                width: parent.width
            }
        }
    }
}
