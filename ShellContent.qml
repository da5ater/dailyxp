import QtQuick
import "arcade"
import "arcade/screens"
import "FixtureLoader.js" as FixtureLoader

// P0 shell chrome + cartridge mounting — the Phase R cockpit (V1, #93).
// Host-independent: pure QtQuick + own Theme, zero qs.* imports. Panel.qml
// embeds this after the in-place gut; the evidence harness captures THIS
// component directly, so proof equals production.
//
// Focus model (R8): the controller row is a FocusScope; the mounted screen
// is a FocusScope (ArcadeScreen); Tab moves controller → screen → back.
// Per-tab state survives switching because Loaders stay alive (active =
// true once first opened; only `visible` toggles).

Rectangle {
    id: root
    width: 420
    height: 640
    color: Theme.background

    property var fixture: FixtureLoader.load()
    property string currentSurface: "Play"
    property var sheetStack: []          // max depth 2

    function openSurface(name) { root.currentSurface = name }
    function pushSheet(component) {
        if (root.sheetStack.length >= 2) return
        // V1 has no sheets yet; placeholder for V2+ (Commitment Sheet etc.)
        root.sheetStack.push(component)
    }

    Column {
        anchors.fill: parent
        spacing: 0

        // ── cartridge viewport ──────────────────────────────────
        Item {
            id: viewport
            width: parent.width
            height: parent.height - controller.height

            // Each tab mounts once, then stays alive; visibility switches.
            // This preserves per-tab state across navigation (AC: state kept).
            Loader {
                id: playLoader
                active: surfaceVisited("Play")
                visible: root.currentSurface === "Play"
                width: parent.width; height: parent.height
                source: "arcade/screens/PlayScreen.qml"
                onLoaded: item.fixture = Qt.binding(function() { return root.fixture })
            }
            Loader {
                id: journeyLoader
                active: surfaceVisited("Journey")
                visible: root.currentSurface === "Journey"
                width: parent.width; height: parent.height
                source: "arcade/screens/JourneyScreen.qml"
                onLoaded: item.fixture = Qt.binding(function() { return root.fixture })
            }
            Loader {
                id: worldLoader
                active: surfaceVisited("World")
                visible: root.currentSurface === "World"
                width: parent.width; height: parent.height
                source: "arcade/screens/WorldScreen.qml"
                onLoaded: item.fixture = Qt.binding(function() { return root.fixture })
            }
            Loader {
                id: setupLoader
                active: surfaceVisited("Setup")
                visible: root.currentSurface === "Setup"
                width: parent.width; height: parent.height
                source: "arcade/screens/SetupScreen.qml"
                onLoaded: item.fixture = Qt.binding(function() { return root.fixture })
            }

        }

        // ── controller nav (A1) ─────────────────────────────────
        Rectangle {
            id: controller
            width: parent.width
            height: 52
            color: Theme.surfaceLowest
            border.color: Theme.border
            border.width: 2

            Row {
                anchors.fill: parent
                Repeater {
                    model: [
                        { name: "Play",    label: "PLAY" },
                        { name: "Journey", label: "JOURNEY" },
                        { name: "World",   label: "WORLD" },
                        { name: "Setup",   label: "SETUP" }
                    ]
                    delegate: Rectangle {
                        id: tabButton
                        required property var modelData
                        required property int index
                        width: controller.width / 4
                        height: parent.height
                        color: root.currentSurface === modelData.name
                               ? Theme.surface : "transparent"

                        Text {
                            anchors.centerIn: parent
                            text: tabButton.modelData.label
                            color: root.currentSurface === tabButton.modelData.name
                                   ? "#ffebc4" : Theme.textMuted
                            font.family: Theme.fontFamily
                            font.pixelSize: 12
                            font.bold: true
                            font.letterSpacing: 2
                        }

                        // gold underline segment marks current tab (A1)
                        Rectangle {
                            visible: root.currentSurface === tabButton.modelData.name
                            width: parent.width - Theme.space(5)
                            height: 3
                            anchors.horizontalCenter: parent.horizontalCenter
                            anchors.bottom: parent.bottom
                            color: Theme.coinGold
                        }

                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.openSurface(tabButton.modelData.name)
                        }
                        Keys.onReturnPressed: root.openSurface(tabButton.modelData.name)

                        // visible focus ring (R8)
                        Rectangle {
                            anchors.fill: parent
                            color: "transparent"
                            border.color: Theme.coinGold
                            border.width: tabButton.activeFocus ? 2 : 0
                        }
                    }
                }
            }
        }
    }

    // visited-map lives on root so loaders can query it
    property var visited: ({})
    function surfaceVisited(name) {
        if (name === root.currentSurface) return true
        return root.visited[name] === true
    }

    onCurrentSurfaceChanged: visited[currentSurface] = true
    Component.onCompleted: visited["Play"] = true

    // Esc pops topmost sheet (V1: no sheets yet — reserved wiring, N4)
    Keys.onEscapePressed: if (root.sheetStack.length > 0) root.sheetStack.pop()
}
