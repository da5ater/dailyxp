import QtQuick

// Scanline overlay primitive: 1px rows every 2px, background zones only.
// Software-safe replacement for the GLSL pass the software renderer skips
// (spike S2 rule). Standalone type because inline components on a QtObject
// singleton aren't usable as attached types.
Item {
    id: scanRoot
    property real alpha: 0.06
    Repeater {
        model: scanRoot.height / 2 > 0 ? Math.ceil(scanRoot.height / 2) : 0
        Rectangle {
            required property int index
            y: index * 2
            width: scanRoot.width
            height: 1
            color: Qt.rgba(0, 0, 0, scanRoot.alpha)
        }
    }
}
