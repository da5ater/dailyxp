import QtQuick
import "arcade"
import "arcade/screens"
import "FixtureLoader.js" as FixtureLoader

// design.md is the single source of truth for the visual language
// (projects/dailyxp/design.md, "90s Retro Video Game", alpha).

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

    // design.md typography: Press Start 2P bundled (OFL). Loads before any
    // Text resolves Theme.fontFamily; fallback chain lives in Theme.
    FontLoader {
        id: ps2pLoader
        source: "fonts/PressStart2P-Regular.ttf"
    }

    implicitWidth: 420
    implicitHeight: viewportHeight + controller.height + Theme.space(4)
    property int viewportHeight: 588   // cartridge area; panel scrolls around it
    height: implicitHeight
    color: Theme.background

    property var fixture: FixtureLoader.load()
    property string currentSurface: "Play"
    property bool recoveryOpen: false    // guarded overlay (P7->P8)
    property var sheetStack: []          // max depth 2

    function openSurface(name) { root.currentSurface = name }
    function openRecovery() { root.recoveryOpen = true }   // guard confirm lands with V7 bind
    function closeRecovery() { root.recoveryOpen = false }
    function scrollBy(delta) {
        // keyboard scroll entry point — host PanelKeyCatcher routes arrows /
        // j/k here (its onMoveRequested was previously unconnected, so every
        // arrow press died in the signal). Clamped; no-op when content fits.
        var max = viewport.contentHeight - viewport.height
        viewport.contentY = Math.max(0, Math.min(viewport.contentY + delta, max))
    }
    function forceControllerFocus() {
        // R8 entry point: host hands focus here on panel open.
        root.focus = true
        controller.forceActiveFocus()
    }
    function pushSheet(component) {
        if (root.sheetStack.length >= 2) return
        // V1 has no sheets yet; placeholder for V2+ (Commitment Sheet etc.)
        root.sheetStack.push(component)
    }

    Column {
        anchors.fill: parent
        spacing: 0

        // ── cartridge viewport — scrolls when the cockpit exceeds it ──
        // Declarative scroll: screens are children of `page`, and Flickable's
        // contentHeight binds to page.childrenRect. No imperative geometry.
        Flickable {
            id: viewport
            width: parent.width
            height: root.viewportHeight
            clip: true
            contentWidth: width
            contentHeight: Math.max(page.childrenRect.height, height)
            boundsBehavior: Flickable.StopAtBounds
            interactive: contentHeight > height

            Item {
                id: page
                width: viewport.width
                y: -viewport.contentY   // manual content offset (children of
                                        // Flickable don't auto-scroll)
            }

            // keep-alive cache: each surface loads once via createObject, then
            // stays mounted; only visibility toggles (per-tab state kept, R5)
            property var cache: ({})

            function show(name) {
                var sources = {
                    "Play": "arcade/screens/PlayScreen.qml",
                    "Journey": "arcade/screens/JourneyScreen.qml",
                    "World": "arcade/screens/WorldScreen.qml",
                    "Setup": "arcade/screens/SetupScreen.qml",
                    "Recovery": "arcade/screens/RecoveryScreen.qml"
                }
                if (!cache[name] && sources[name]) {
                    var comp = Qt.createComponent(sources[name])
                    if (comp.status === Component.Error) console.log("CREATE FAIL: " + comp.errorString())
                    var obj = comp.createObject(page, {
                        fixture: Qt.binding(function() { return root.fixture }),
                        shellApi: root,
                        visible: false,
                        width: Qt.binding(function() { return viewport.width })
                    })
                    // screens declare implicitHeight; bind real height after
                    // creation so Flickable's childrenRect tracks content growth
                    obj.height = Qt.binding(function() {
                        return Math.max(obj.implicitHeight, viewport.height)
                    })
                    cache[name] = obj
                }
                var target = root.recoveryOpen ? "Recovery" : name
                for (var k in cache) cache[k].visible = (k === target)
            }

            Component.onCompleted: show("Play")

            Connections {
                target: root
                function onCurrentSurfaceChanged() { viewport.show(root.currentSurface); viewport.contentY = 0 }
                function onRecoveryOpenChanged() { viewport.show(root.currentSurface); viewport.contentY = 0 }
            }

            // ── TEMP LIVE-SCROLL DIAGNOSTICS (#93) — REMOVE BEFORE FINAL REX ──
            // Third live report of unreachable below-fold content. The offscreen
            // probe proves geometry (contentHeight=708 > height=588,
            // interactive=true) but cannot prove input delivery through the
            // host stack. These loggers answer with data: if a wheel scroll or
            // drag reaches this Flickable and works, contentY moves and logs;
            // total silence means events never arrive or are refused.
            onDraggingChanged: console.log("[SCROLL-DIAG] dragging=" + dragging)
            onContentYChanged: console.log("[SCROLL-DIAG] contentY=" + contentY)
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
                            font.pixelSize: Theme.typeTitle
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

    // Esc pops topmost sheet (V1: no sheets yet — reserved wiring, N4)
    Keys.onEscapePressed: {
        if (root.recoveryOpen) root.recoveryOpen = false
        else if (root.sheetStack.length > 0) root.sheetStack.pop()
    }
}
