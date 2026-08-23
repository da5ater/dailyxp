import QtQuick

// Arcade primitive: labeled stat tile (K2) — LV / RANK / MOMENTUM tiles,
// XP chips. Label in muted caps, value in coin gold.
Rectangle {
    id: root

    property string label: ""
    property string value: ""
    property color valueColor: Theme.coinGold
    property bool compact: false

    implicitWidth: compact ? Math.max(64, valueText.implicitWidth + Theme.space(5))
                           : Math.max(96, valueText.implicitWidth + Theme.space(8))
    implicitHeight: compact ? 24 : 54
    color: compact ? Theme.surfaceLow : Theme.surfaceLow
    border.color: compact ? valueColor : Theme.border
    border.width: 1

    Column {
        visible: !root.compact
        anchors.centerIn: parent
        spacing: 2

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.label
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: 9
            font.letterSpacing: 2
        }
        Text {
            id: valueText
            anchors.horizontalCenter: parent.horizontalCenter
            text: root.value
            color: root.valueColor
            font.family: Theme.fontFamily
            font.pixelSize: 20
            font.bold: true
        }
    }

    Text {
        visible: root.compact
        text: root.label + " " + root.value
        color: root.valueColor
        font.family: Theme.fontFamily
        font.pixelSize: 12
        font.bold: true
        anchors.centerIn: parent
    }
}
