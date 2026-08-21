import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "SessionModel.js" as SessionModel

BarWidget {
  id: root
  moduleName: "io.github.da5ater.dailyxp"

  readonly property var stateStore: bar && bar.shell ? bar.shell.serviceFor(moduleName) : null
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false
  property string sessionNowUtc: new Date().toISOString()
  readonly property var activeSession: stateStore ? stateStore.sessionProjection.activeSession : null
  readonly property var sessionSummary: activeSession
    ? SessionModel.summaryAt(stateStore.sessionProjection, sessionNowUtc) : null

  function formatElapsed(milliseconds) {
    var totalMinutes = Math.floor(Number(milliseconds || 0) / 60000)
    var hours = Math.floor(totalMinutes / 60)
    var minutes = totalMinutes % 60
    return hours > 0 ? hours + "h " + String(minutes).padStart(2, "0") + "m" : minutes + "m"
  }

  function toggleSessionRunState() {
    if (!stateStore || !activeSession) return
    var type = activeSession.status === "running" ? "session.pause" : "session.resume"
    stateStore.applySessionCommand({ type: type, atUtc: new Date().toISOString() })
  }

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("stateStore" in target) target.stateStore = stateStore
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onStateStoreChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  IpcHandler {
    target: root.moduleName
    function addProbe(): string {
      if (!root.stateStore) return "unavailable"
      root.stateStore.addProbe()
      return root.stateStore.errorMessage === "" ? "ok" : "error"
    }
    function ensurePlanningDay(): string {
      if (!root.stateStore) return "unavailable"
      var applied = root.stateStore.ensureCurrentPlanningDay()
      if (root.stateStore.errorMessage !== "") return "error: " + root.stateStore.errorMessage
      return applied ? "requested" : "not-started"
    }
    function planningDayStatus(): string {
      if (!root.stateStore) return JSON.stringify({ available: false })
      return JSON.stringify({
        available: true,
        saving: root.stateStore.saving,
        error: root.stateStore.errorMessage,
        lastAdvancedDailyXpDate: root.stateStore.planningProjection.lastAdvancedDailyXpDate
      })
    }
    function sessionCommand(json: string): string {
      if (!root.stateStore) return "unavailable"
      var applied = root.stateStore.applySessionCommand(JSON.parse(json))
      if (root.stateStore.errorMessage !== "") return "error: " + root.stateStore.errorMessage
      return applied ? "requested" : "not-started"
    }
    function sessionStatus(): string {
      if (!root.stateStore) return JSON.stringify({ available: false })
      return JSON.stringify({
        available: true,
        saving: root.stateStore.saving,
        error: root.stateStore.errorMessage,
        projection: root.stateStore.sessionProjection,
        confirmation: root.stateStore.sessionConfirmation
      })
    }
    function open(): void { root.open() }
    function close(): void { root.close() }
    function show(): void { root.open() }
    function hide(): void { root.close() }
    function toggle(): void { root.togglePanel() }
  }

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: root.activeSession
      ? (root.activeSession.status === "running" ? "󰐊 " : "󰏤 ") + root.formatElapsed(root.sessionSummary.focusedMilliseconds)
      : (root.vertical ? "󰓎" : "DailyXP")
    labelVisible: true
    tooltipText: root.activeSession
      ? (root.activeSession.status === "running" ? "Right-click to pause Session" : "Right-click to resume Session")
      : (root.stateStore && root.stateStore.ready ? "Open DailyXP" : "Loading DailyXP")
    hasVisualContent: true
    horizontalMargin: 8.75
    verticalPadding: 8.75
    onPressed: function(mouseButton) {
      if (mouseButton === Qt.LeftButton) root.togglePanel()
      else if (mouseButton === Qt.RightButton) root.toggleSessionRunState()
    }
  }

  Timer {
    interval: 1000
    repeat: true
    running: root.activeSession && root.activeSession.status === "running"
    triggeredOnStart: true
    onTriggered: root.sessionNowUtc = new Date().toISOString()
  }
}
