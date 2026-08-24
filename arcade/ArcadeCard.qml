import QtQuick

// Arcade primitive: quest-style card with header ribbon (K2).
// The ribbon color identifies the category. Composition rules (frontend-design
// pass, Mohamed feedback 2026-08-24): content drives height via Column
// childrenRect measured INSIDE a fixed-position wrapper (reliable), generous
// internal padding so text breathes, ribbon strip sized to its type.
Rectangle {
    id: root

    default property alias content: contentArea.data
    property string ribbon: ""
    property color ribbonColor: Theme.powerGreen
    property color ribbonText: Theme.greenDeep
    property bool emphasized: false   // the one dominant card on a surface

    implicitWidth: 380
    // padding: 12px frame + 8px gap under ribbon + content height + 12px bottom
    implicitHeight: (ribbon.length > 0 ? Theme.space(7) + Theme.space(2) : Theme.space(3))
                    + contentArea.height + Theme.space(6)
    color: root.emphasized ? Theme.surface : Theme.surfaceLow
    border.color: root.emphasized ? Theme.coinGold : Theme.border
    border.width: root.emphasized ? 2 : 2

    Rectangle {
        id: ribbonRect
        visible: root.ribbon.length > 0
        width: parent.width
        // PS2P at typeTiny needs ~14px glyph height; give the strip room
        height: Theme.typeTiny + Theme.space(5)
        color: root.ribbonColor

        Text {
            anchors.centerIn: parent
            text: root.ribbon
            color: root.ribbonText
            font.family: Theme.fontFamily
            font.pixelSize: Theme.typeTiny
            font.bold: true
            font.letterSpacing: 1
            width: parent.width - Theme.space(2)
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
        }
    }

    // fixed top offset, then let the Column report its own height — no
    // childrenRect-on-parent timing traps
    Column {
        id: contentArea
        x: Theme.space(4)
        y: root.ribbon.length > 0 ? ribbonRect.height + Theme.space(2) : Theme.space(3)
        width: root.width - Theme.space(8)
        spacing: Theme.space(2)
    }
}
