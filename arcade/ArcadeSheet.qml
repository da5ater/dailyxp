import QtQuick
import QtQuick.Controls.Basic

Item {
    id: root
    default property alias content: bodyColumn.data
    property alias closeControl: closeButton
    property var initialFocusItem: null
    property string title: ""
    property bool dismissEnabled: true
    signal dismissed()

    function ensureVisible(item) {
        var point = item.mapToItem(bodyColumn, 0, 0)
        if (point.y < viewport.contentY) viewport.contentY = point.y
        else if (point.y + item.height > viewport.contentY + viewport.height)
            viewport.contentY = point.y + item.height - viewport.height
        viewport.contentY = Math.max(0, Math.min(viewport.contentY, viewport.contentHeight - viewport.height))
    }
    Rectangle {
        anchors.fill: parent
        color: Qt.rgba(0, 0, 0, 0.55)
        MouseArea { anchors.fill: parent }
    }
    Rectangle {
        id: panel
        width: Math.min(parent.width - Theme.space(6), 360)
        height: Math.min(parent.height - Theme.space(8),
                         header.height + bodyColumn.implicitHeight + Theme.space(11))
        anchors.centerIn: parent
        color: Theme.surface
        border.color: Theme.border
        border.width: 2

        Row {
            id: header
            x: Theme.space(4)
            y: Theme.space(4)
            width: parent.width - Theme.space(8)
            spacing: Theme.space(2)
            Text {
                width: parent.width - closeButton.width - parent.spacing
                text: root.title
                color: "#ffebc4"
                font.family: Theme.fontFamily
                font.pixelSize: Theme.typeTitle
                font.bold: true
                font.letterSpacing: 3
                anchors.verticalCenter: parent.verticalCenter
                elide: Text.ElideRight
            }
            Rectangle {
                id: closeButton
                objectName: "closeSheetButton"
                width: 26; height: 26
                enabled: root.dismissEnabled
                activeFocusOnTab: true
                KeyNavigation.tab: root.initialFocusItem
                Accessible.role: Accessible.Button
                Accessible.name: "Close " + root.title
                color: backMouse.containsMouse ? Theme.surfaceHigh : Theme.surfaceLow
                border.color: activeFocus ? Theme.coinGold : Theme.border
                border.width: 2
                Text { anchors.centerIn: parent; text: "✕"; color: Theme.textPrimary; font.pixelSize: Theme.typeBody }
                MouseArea {
                    id: backMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.dismissed()
                }
                Keys.onReturnPressed: root.dismissed()
                Keys.onSpacePressed: root.dismissed()
            }
        }
        Flickable {
            id: viewport
            objectName: "sheetViewport"
            anchors.left: parent.left
            anchors.right: parent.right
            anchors.top: header.bottom
            anchors.bottom: parent.bottom
            anchors.leftMargin: Theme.space(4)
            anchors.rightMargin: Theme.space(4)
            anchors.topMargin: Theme.space(3)
            anchors.bottomMargin: Theme.space(4)
            contentWidth: width
            contentHeight: bodyColumn.implicitHeight
            clip: true
            boundsBehavior: Flickable.StopAtBounds
            ScrollBar.vertical: ScrollBar { }
            Column {
                id: bodyColumn
                width: viewport.width
                spacing: Theme.space(3)
            }
        }
    }
    Keys.onEscapePressed: if (dismissEnabled) dismissed()
}
