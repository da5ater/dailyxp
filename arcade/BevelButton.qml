import QtQuick

// Arcade primitive: NES-style beveled button (K2).
// L2 interactive — 3px hard bottom shadow; pressed state sinks 2px and
// swaps to the dim fill. Keyboard operable with a visible focus ring (R8).
Rectangle {
    id: root

    property string label: ""
    property color baseColor: Theme.coinGold
    property color textColor: Theme.goldDeep
    property bool danger: false

    signal activated()

    implicitWidth: Math.max(120, label_.implicitWidth + Theme.space(10))
    implicitHeight: 44
    radius: 0

    // hard-offset shadow layer
    Rectangle {
        y: mouse.pressed ? 5 : 3
        width: parent.width
        height: parent.height - 3
        color: Qt.rgba(0, 0, 0, 0.40)
    }

    Rectangle {
        id: face
        width: parent.width
        height: parent.height - 3
        y: mouse.pressed ? 2 : 0
        color: {
            if (root.danger) return mouse.pressed ? "#7a1c14" : "#b3402f"
            return mouse.pressed ? Theme.goldDim : root.baseColor
        }
        border.color: root.danger ? "#ffb4ab" : Theme.goldBevel
        border.width: root.activeFocus || mouse.containsMouse ? 3 : 2

        Text {
            id: label_
            anchors.centerIn: parent
            text: root.label
            color: root.danger ? "#ffdad6" : (mouse.pressed ? "#ffebc4" : root.textColor)
            font.family: Theme.fontFamily
            font.pixelSize: 15
            font.bold: true
            font.letterSpacing: 2
        }
    }

    MouseArea {
        id: mouse
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.activated()
    }

    Keys.onReturnPressed: root.activated()
    Keys.onEnterPressed: root.activated()
    Keys.onSpacePressed: root.activated()

    // visible focus ring (R8): gold outline offset from the face
    Rectangle {
        anchors.fill: face
        anchors.margins: -4
        color: "transparent"
        border.color: Theme.coinGold
        border.width: root.activeFocus ? 2 : 0
    }

}
