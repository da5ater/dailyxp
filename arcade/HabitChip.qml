import QtQuick

Rectangle {
    id: root
    property string title: ""
    property string stateLabel: "open"
    property int streak: 0
    signal completed()
    signal skipped()
    activeFocusOnTab: true
    Accessible.role: Accessible.Button
    Accessible.name: title + ", " + stateLabel + ", streak " + streak
    implicitHeight: 48
    color: pointer.pressed ? Theme.surfaceHigh : stateLabel === "done" ? Theme.greenDeep : Theme.surfaceLow
    border.color: activeFocus ? Theme.coinGold : stateLabel === "done" ? Theme.powerGreen : Theme.border
    border.width: activeFocus ? 3 : 1
    Text {
        anchors.fill: parent
        anchors.margins: Theme.space(2)
        text: (root.stateLabel === "done" ? "✔ " : root.stateLabel === "skipped" ? "SKIPPED · " : "○ ")
              + root.title + " · ×" + root.streak
        color: Theme.textPrimary
        font.family: Theme.fontFamily
        font.pixelSize: Theme.typeBody
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
    MouseArea {
        id: pointer
        anchors.fill: parent
        property bool held: false
        cursorShape: Qt.PointingHandCursor
        onPressed: held = false
        onPressAndHold: { held = true; root.forceActiveFocus(); root.skipped() }
        onClicked: { root.forceActiveFocus(); if (!held) root.completed() }
    }
    Keys.onReturnPressed: event => { if (!event.isAutoRepeat) root.completed() }
    Keys.onEnterPressed: event => { if (!event.isAutoRepeat) root.completed() }
    Keys.onSpacePressed: event => { if (!event.isAutoRepeat) root.completed() }
    Keys.onDeletePressed: event => { if (!event.isAutoRepeat) root.skipped() }
}
