import QtQuick
import QtQuick.Controls.Basic

// Arcade primitive: blocking focused-interaction sheet (K2).
// Dark scrim + surface panel; Esc and the back chip both close via the
// shell's sheet stack. Max stack depth 2 is enforced by the shell, not here.
Item {
    id: root

    default property alias content: panelColumn.data
    property string title: ""
    signal dismissed()

    // scrim — blocks interaction with what's behind (Place boundary)
    Rectangle {
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, 0.55)
    }

    Rectangle {
        id: panel
        width: Math.min(parent.width - Theme.space(6), 360)
        height: Math.min(parent.height - Theme.space(8),
                         panelColumn.childrenRect.height + Theme.space(8))
        anchors.centerIn: parent
        color: Theme.surface
        border.color: Theme.border
        border.width: 2

        Column {
            id: panelColumn
            anchors.fill: parent
            anchors.margins: Theme.space(4)
            spacing: Theme.space(3)

            Row {
                width: parent.width
                spacing: Theme.space(2)

                Text {
                    text: root.title
                    color: "#ffebc4"
                    font.family: Theme.fontFamily
                    font.pixelSize: Theme.typeTitle
                    font.bold: true
                    font.letterSpacing: 3
                    anchors.verticalCenter: parent.verticalCenter
                }

                Item { width: 1; height: 1 }  // spacer pushes chip right

                Rectangle {
                    id: backChip
                    width: 26; height: 26
                    color: backMouse.containsMouse ? Theme.surfaceHigh : Theme.surfaceLow
                    border.color: Theme.border
                    border.width: 2
                    anchors.verticalCenter: parent.verticalCenter

                    Text {
                        anchors.centerIn: parent
                        text: "✕"
                        color: Theme.textPrimary
                        font.pixelSize: Theme.typeBody
                    }
                    MouseArea {
                        id: backMouse
                        anchors.fill: parent
                        hoverEnabled: true
                        cursorShape: Qt.PointingHandCursor
                        onClicked: root.dismissed()
                    }
                    Keys.onReturnPressed: root.dismissed()
                }
            }
        }
    }

    Keys.onEscapePressed: root.dismissed()
}
