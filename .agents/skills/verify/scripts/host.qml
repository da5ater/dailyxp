import QtQuick
import QtTest
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "app" as DailyXP

ShellRoot {
  id: host
  property var shellConfig: ({ plugins: [] })
  function serviceFor(name) { return store }
  DailyXP.StateStore { id: store; shell: host }
  property string captureState: "idle"
  property bool seeded: Quickshell.env("DAILYXP_VERIFY_SEED") !== "true"
  Timer {
    interval: 50
    repeat: true
    running: !host.seeded
    onTriggered: {
      if (!store.ready || !store.recordingReady || store.saving) return
      if (store.planningProjection.tasks.length > 0) { host.seeded = true; return }
      host.seeded = store.applyPlanningCommand({ type: "task.create", task: {
        id: "verify-commitment", title: "Ruby study", estimateMinutes: 30,
        primarySkill: "general/focus", urgency: "normal", deadline: null, goalId: null, milestoneId: null
      } })
    }
  }
  TestCase { id: input; name: "DailyXPDriver"; when: false }
  IpcHandler {
    target: "dailyxp-verify"
    function click(name: string): string {
      var item = input.findChild(productionWidget, name)
      if (!item || !item.visible || !item.enabled) return "unavailable"
      input.parent = input.findChild(productionWidget, "dailyxpShell")
      input.mouseClick(item, item.width / 2, item.height / 2)
      return "clicked"
    }
    function key(name: string, key: string): string {
      var item = input.findChild(productionWidget, name)
      if (!item || !item.visible || !item.enabled) return "unavailable"
      input.parent = input.findChild(productionWidget, "dailyxpShell")
      item.forceActiveFocus()
      var keys = { "Return": Qt.Key_Return, "Space": Qt.Key_Space, "Tab": Qt.Key_Tab, "Escape": Qt.Key_Escape }
      if (keys[key] === undefined) return "unknown-key"
      input.keyClick(keys[key])
      return "pressed"
    }
    function ui(): string {
      var result = {}
      var shellItem = input.findChild(productionWidget, "dailyxpShell")
      var names = ["startSessionButton", "pauseSessionButton", "finishSessionButton", "sessionTimer", "sessionState", "sessionResult", "dailyxpShell"]
      for (var i = 0; i < names.length; i++) {
        var item = input.findChild(productionWidget, names[i])
        var point = item && shellItem ? item.mapToItem(shellItem, 0, 0) : { x: 0, y: 0 }
        if (item) result[names[i]] = { x: point.x, y: point.y, visible: item.visible, enabled: item.enabled,
          text: item.text || item.label || "", focus: item.activeFocus,
          width: item.width, height: item.height }
      }
      result.panelOpened = productionWidget.opened
      return JSON.stringify(result)
    }
    function capturePanel(path: string): string {
      var item = input.findChild(productionWidget, "dailyxpShell")
      if (!item || !item.visible) return "unavailable"
      host.captureState = "pending"
      item.grabToImage(function(result) { host.captureState = result.saveToFile(path) ? "saved" : "failed" })
      return "requested"
    }
    function captureStatus(): string { return host.captureState }
    function readiness(): string { return JSON.stringify({ready:store.ready, journal:store.journalReady, timezone:store.systemTimezone, saving:store.saving, error:store.errorMessage, primaryRead:store._primaryRead, backupRead:store._backupRead, seeded:host.seeded}) }
    function ready(): bool { return host.seeded && store.ready && store.recordingReady && !store.saving && store.errorMessage === "" }
  }
  QtObject {
    id: barHost
    property var shell: host
    property bool vertical: false
    property int barSize: 40
    property int sizeHorizontal: 40
    property string position: "top"
    property color foreground: "#eeeeee"
    property color barForeground: foreground
    property string fontFamily: "sans-serif"
    property bool foregroundAnimationEnabled: false
    property bool urgent: false
    property bool centerHoverRevealSuppressed: false
    property var activePopout: null
    property var clickTargets: []
    function requestPopout(owner) { activePopout = owner; return true }
    function releasePopout(owner) { if (activePopout === owner) activePopout = null }
    function targetBelongsToWindow(target, window) { return false }
    function showTooltip() {}
    function hideTooltip() {}
  }
  PanelWindow {
    anchors { top: true; left: true; right: true }
    implicitHeight: 40
    exclusiveZone: 0
    color: "#171717"
    WlrLayershell.namespace: "dailyxp-verify"
    DailyXP.BarWidget { id: productionWidget; anchors.centerIn: parent; bar: barHost }
  }
}
