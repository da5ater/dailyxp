import QtQuick
import "."

// Arcade primitive: one full cartridge screen (K2).
// Owns the surface chrome — background, scanline wash, title, and a
// FocusScope so Tab traversal stays inside the screen (R8). Screens are
// mounted by ShellContent's Loader; per-screen state survives because the
// loader keeps items alive (see shell).
FocusScope {
    id: root

    default property alias content: contentColumn.data
    property string title: ""

    implicitWidth: 388
    implicitHeight: 560

    Rectangle {
        anchors.fill: parent
        color: Theme.background
    }

    Scanlines {
        anchors.fill: parent
        alpha: 0.05
    }

    Column {
        id: contentColumn
        anchors.fill: parent
        anchors.margins: Theme.space(4)
        spacing: Theme.space(3)

        Text {
            visible: root.title.length > 0
            text: root.title
            color: "#ffebc4"
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeHero
            font.bold: true
            font.letterSpacing: 6
        }
    }
}
