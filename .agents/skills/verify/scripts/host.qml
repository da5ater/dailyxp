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
  function findControl(name) {
    var shellItem = input.findChild(productionWidget, "dailyxpShell")
    function visit(item) {
      if (item.objectName === name) return item
      for (var i = 0; i < item.children.length; i++) {
        var found = visit(item.children[i])
        if (found) return found
      }
      return null
    }
    return shellItem ? visit(shellItem) : null
  }
  TestCase { id: input; name: "DailyXPDriver"; when: false }
  IpcHandler {
    target: "dailyxp-verify"
    function click(name: string): string {
      var item = host.findControl(name)
      if (!item || !item.visible || !item.enabled) return "unavailable"
      input.parent = input.findChild(productionWidget, "dailyxpShell")
      input.mouseClick(item, item.width / 2, item.height / 2)
      return "clicked"
    }
    function key(name: string, key: string): string {
      var item = host.findControl(name)
      if (!item || !item.visible || !item.enabled) return "unavailable"
      input.parent = input.findChild(productionWidget, "dailyxpShell")
      item.forceActiveFocus()
      var keys = { "Return": Qt.Key_Return, "Space": Qt.Key_Space, "Tab": Qt.Key_Tab, "Escape": Qt.Key_Escape, "Backtab": Qt.Key_Backtab }
      if (keys[key] === undefined) return "unknown-key"
      input.keyClick(keys[key])
      return "pressed"
    }
    function ui(): string {
      var result = {}
      var shellItem = input.findChild(productionWidget, "dailyxpShell")
      var names = ["startSessionButton", "pauseSessionButton", "finishSessionButton", "sessionTimer", "sessionState", "sessionResult", "dailyxpShell", "journeyLevel", "journeyMomentum", "journeyRank", "journeyXpBar", "journeyXpProgress", "journeyLifetimeXp", "journeyWeeklyInsight", "openLedgerButton", "navigationLabelJourney", "navigationLabelWorld"]
      for (var i = 0; i < names.length; i++) {
        var item = host.findControl(names[i])
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
    function typeText(name: string, text: string): string {
      var item = host.findControl(name)
      if (!item || !item.visible || !item.enabled) return "unavailable"
      input.parent = input.findChild(productionWidget, "dailyxpShell")
      item.forceActiveFocus()
      input.keySequence("Ctrl+A")
      for (var i = 0; i < text.length; i++) input.keyClick(text.charAt(i))
      return "typed"
    }
    function press(key: string): string {
      var keys = { "Return": Qt.Key_Return, "Tab": Qt.Key_Tab, "Escape": Qt.Key_Escape, "Space": Qt.Key_Space, "Backtab": Qt.Key_Backtab }
      input.keyClick(keys[key])
      return "pressed"
    }
    function formStatus(): string {
      var form = input.findChild(productionWidget, "commitmentSheet")
      if (!form) return JSON.stringify({exists:false})
      var items = []
      function visit(item) {
        if (item.visible && (item.objectName || item.text || item.label || item.value)) {
          var point = item.mapToItem(form,0,0)
          items.push({name:item.objectName, text:item.text || item.label || item.value || "",
            x:point.x,y:point.y,width:item.width,height:item.height,focus:item.activeFocus})
        }
        for(var j=0;j<item.children.length;j++) visit(item.children[j])
      }
      visit(form)
      return JSON.stringify({exists:true,error:form.errorText,width:form.width,height:form.height,items:items,
        tasks:store.planningProjection.tasks.length,goals:store.planningProjection.goals.length,saving:store.saving})
    }
    function seedGoal(id: string, title: string): string {
      return store.applyPlanningCommand({type:"goal.create",goal:{id:id,title:title,
        primarySkill:"general/focus",reason:"isolated verification fixture"}}) ? "requested" : "not-started"
    }
    function constrainPanel(width: int): string {
      host.findControl("dailyxpShell").width = width
      return "constrained"
    }
    function journeyStatus(): string {
      var ledger = input.findChild(productionWidget, "ledgerSheet")
      var entries = []
      if (ledger) {
        for (var i = 0; i < ledger.awards.length; i++) {
          var item = host.findControl("ledgerAward-" + i)
          var point = item.mapToItem(ledger, 0, 0)
          entries.push({award:ledger.awards[i],x:point.x,y:point.y,width:item.width,height:item.height,focus:item.activeFocus})
        }
      }
      var viewport = ledger ? host.findControl("sheetViewport") : null
      var position = viewport ? viewport.mapToItem(ledger, 0, 0) : {x:0,y:0}
      return JSON.stringify({projection:store.progressionProjection,events:store.journal.events,
        ledgerOpen:ledger !== null,entries:entries,
        viewport:viewport ? {x:position.x,y:position.y,width:viewport.width,height:viewport.height} : null})
    }
    function seedTimedSession(minutes: int): string {
      return store.applySessionCommand({type:"session.start",session:{id:Date.now().toString(),
        taskId:"verify-commitment",primarySkill:"general/focus",plannedMinutes:null,
        startedAtUtc:new Date(Date.now() - minutes * 60000).toISOString()}}) ? "requested" : "not-started"
    }
    function planningStatus(): string { return JSON.stringify({projection:store.planningProjection,error:store.errorMessage,saving:store.saving}) }
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
