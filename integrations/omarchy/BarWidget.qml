import QtQuick
import qs.Ui as Ui

Ui.BarWidget {
  id: root
  moduleName: "io.github.da5ater.dailyxp"
  readonly property var hostBar: bar
  readonly property var service: hostBar && hostBar.shell ? hostBar.shell.serviceFor(moduleName) : null
  readonly property var current: service && service.connected ? service.status : null
  readonly property var session: current ? current.session : null
  function elapsed(ms) { return Math.floor(Number(ms || 0) / 60000) + "m" }
  function label() {
    if (!current) return "DailyXP"
    if (session) return (session.status === "running" ? "▶ " : "Paused · ") + elapsed(session.focusedMilliseconds)
    if (service && service.feedback) return service.feedback
    return "Lv " + current.level + " · " + current.storyRank
  }
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight
  Ui.WidgetButton {
    id: button
    objectName: "dailyxpCompanionButton"
    bar: root.bar
    text: root.label()
    tooltipText: root.session ? "DailyXP · click to open · right-click to pause or resume" : "Open DailyXP"
    onPressed: function(mouseButton) {
      if (!root.service) return
      if (mouseButton === Qt.RightButton && root.session && !root.service.busy)
        root.service.invoke(root.session.status === "running" ? "pause" : "resume")
      else if (mouseButton === Qt.LeftButton) root.service.open()
    }
  }
}
