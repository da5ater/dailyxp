import QtQuick

// Arcade primitive: quest-style card with header ribbon (K2).
// The ribbon color identifies the category (green daily, gold focus,
// purple skill). Content area is a slot for the composing screen.
Rectangle {
    id: root

    default property alias content: contentArea.data
    property string ribbon: ""
    property color ribbonColor: Theme.powerGreen
    property color ribbonText: Theme.greenDeep

    implicitWidth: 380
    implicitHeight: ribbon.length > 0
                    ? 26 + contentArea.childrenRect.height + Theme.space(4)
                    : Theme.space(3) + contentArea.childrenRect.height + Theme.space(4)
    color: Theme.surfaceLow
    border.color: Theme.border
    border.width: 2

    Rectangle {
        id: ribbonRect
        visible: root.ribbon.length > 0
        width: parent.width
        height: 18
        color: root.ribbonColor

        Text {
            anchors.centerIn: parent
            text: root.ribbon
            color: root.ribbonText
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTiny
            font.bold: true
            font.letterSpacing: 2
        }
    }

    Column {
        id: contentArea
        anchors.top: parent.top
        anchors.topMargin: root.ribbon.length > 0 ? 24 : Theme.space(3)
        anchors.left: parent.left
        anchors.leftMargin: Theme.space(3)
        anchors.right: parent.right
        anchors.rightMargin: Theme.space(3)
        spacing: 4
    }
}
