import QtQuick

// Arcade primitive: discrete-block progress bar (K2).
// No smooth fills — vertical blocks with 2px gaps, spike-proven 8-bit read.
Rectangle {
    id: root

    property real fraction: 0        // 0..1
    property int blocks: 24
    property color fill: Theme.coinGold
    property color fillBorder: Theme.goldDim
    property color empty: Theme.surfaceLowest
    property color emptyBorder: Theme.border

    implicitWidth: blocks * 15 - 2
    implicitHeight: 16
    color: "transparent"

    Row {
        spacing: 2
        Repeater {
            model: root.blocks
            delegate: Rectangle {
                required property int index
                width: 13
                height: root.height
                color: index < Math.round(root.fraction * root.blocks) ? root.fill : root.empty
                border.color: index < Math.round(root.fraction * root.blocks) ? root.fillBorder : root.emptyBorder
                border.width: 1
            }
        }
    }
}
