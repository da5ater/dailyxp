import QtQuick

// Arcade primitive: discrete-block progress bar (K2).
// No smooth fills — uniform segments with even gaps, spike-proven 8-bit read.
// Block width derives from the ASSIGNED width (not a hardcoded px value), so
// every segment is identical and the row fills edge-to-edge at any panel size
// (live-testing finding #24/#93: fixed-width blocks rendered raggedly).
Rectangle {
    id: root

    property real fraction: 0        // 0..1
    property int blocks: 24
    property color fill: Theme.coinGold
    property color fillBorder: Theme.goldDim
    property color empty: Theme.surfaceLowest
    // textMuted border so the empty track reads against dark cards
    // (live pass #27: previous border token vanished into the background)
    property color emptyBorder: Theme.textMuted

    // 3px gaps keep every segment reading as its own dash — filled runs must
    // never fuse into one slab (Mohamed live pass: wanted "- _ -", not "=")
    readonly property int gap: 3
    // floor keeps integer pixel widths — no sub-pixel fuzz under software
    // rendering; the leftover (<blocks px) stays transparent at the right edge
    readonly property int blockWidth: Math.max(1,
        Math.floor((width - (blocks - 1) * gap) / blocks))

    implicitWidth: blocks * 15 - 2
    implicitHeight: 16
    color: "transparent"

    Row {
        spacing: root.gap
        Repeater {
            model: root.blocks
            delegate: Rectangle {
                required property int index
                width: root.blockWidth
                height: root.height
                color: index < Math.round(root.fraction * root.blocks) ? root.fill : root.empty
                border.color: index < Math.round(root.fraction * root.blocks) ? root.fillBorder : root.emptyBorder
                border.width: 1
            }
        }
    }
}
