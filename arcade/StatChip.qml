import QtQuick

// Arcade primitive: labeled stat tile (K2) — LV / RANK / MOMENTUM tiles,
// XP chips. Label in muted caps, value in coin gold.
Rectangle {
    id: root

    property string label: ""
    property string value: ""
    property color valueColor: Theme.coinGold
    property bool compact: false

    implicitWidth: compact ? Math.max(64, valueText.implicitWidth + Theme.space(6))
                           : Math.max(96, valueText.implicitWidth + Theme.space(8))
    implicitHeight: compact ? 24 : 54
    color: compact ? Theme.surfaceLow : Theme.surfaceLow
    border.color: compact ? valueColor : Theme.border
    border.width: 1

    Column {
        visible: !root.compact
        anchors.centerIn: parent
        spacing: 2
        width: parent.width

        Text {
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width
            text: root.label
            color: Theme.textMuted
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeBody
            font.letterSpacing: 2
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
        }
        Text {
            id: valueText
            anchors.horizontalCenter: parent.horizontalCenter
            width: parent.width
            text: root.value
            color: root.valueColor
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeHero
            font.bold: true
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
        }
    }

    // compact chip: bounded to its box — a long value elides instead of
    // painting past the chip edge (horizontal-overflow fix, #93)
    Text {
        visible: root.compact
        width: parent.width - Theme.space(2)
        anchors.centerIn: parent
        text: root.label + " " + root.value
        color: root.valueColor
        font.family: Theme.fontFamily
        font.pixelSize: Theme.typeBody
        font.bold: true
        horizontalAlignment: Text.AlignHCenter
        elide: Text.ElideRight
    }
}
