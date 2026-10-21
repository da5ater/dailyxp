import QtQuick
import QtTest
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "companion" as Companion

ShellRoot {
  id: host
  function serviceFor(name) { return service }
  Companion.Service { id: service; shell: host }
  TestCase { id: input; name: "CompanionDriver"; when: false }
  IpcHandler {
    target: "dailyxp-companion-verify"
    function status(): string { return JSON.stringify({ connected: service.connected, status: service.status, error: service.errorMessage, label: widget.label() }) }
    function click(button: string): string {
      input.parent = widget
      input.mouseClick(widget, widget.width / 2, widget.height / 2, button === "right" ? Qt.RightButton : Qt.LeftButton)
      return "clicked"
    }
  }
  QtObject {
    id: barHost
    property var shell: host
    property bool vertical: false
    property int barSize: 40
    property color barForeground: "#ffffff"
    property color urgent: "#f1b84b"
    property string fontFamily: "sans-serif"
    property bool foregroundAnimationEnabled: false
    function registerClickTarget(target) {}
    function unregisterClickTarget(target) {}
    function showTooltip() {}
    function hideTooltip() {}
  }
  PanelWindow {
    anchors { top: true; left: true; right: true }
    implicitHeight: 40
    exclusiveZone: 40
    color: "#17191b"
    Companion.BarWidget { id: widget; anchors.centerIn: parent; bar: barHost }
  }
}
