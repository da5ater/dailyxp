import QtQuick
import Quickshell
import Quickshell.Io

Item {
  id: root
  property var shell: null
  property var status: null
  property bool connected: false
  property string errorMessage: ""
  property bool busy: false
  property string feedback: ""
  property int lastXp: -1
  property int lastLevel: -1
  function acceptStatus(value) {
    if (lastXp >= 0 && value.lifetimeXp > lastXp) {
      feedback = value.level > lastLevel ? "Level " + value.level : "+" + (value.lifetimeXp - lastXp) + " XP"
      feedbackExpiry.restart()
    }
    lastXp = value.lifetimeXp
    lastLevel = value.level
    status = value
    connected = value.version === 1
    errorMessage = ""
    busy = false
  }
  function disconnect() {
    connected = false
    status = null
    lastXp = -1
    lastLevel = -1
    feedback = ""
    busy = false
    errorMessage = "Open DailyXP to connect"
  }
  readonly property string controller: Quickshell.env("DAILYXP_CTL") || (Quickshell.env("HOME") + "/.local/bin/dailyxpctl")
  property string pendingId: ""
  function poll() {
    if (!poller.running && !action.running) poller.running = true
  }
  function invoke(method) {
    if (action.running) return
    pendingId = "omarchy-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    busy = true
    action.command = [controller, method, pendingId]
    action.running = true
  }
  function open() {
    if (connected) invoke("open")
    else if (!launcher.running) launcher.running = true
  }
  Process {
    id: poller
    command: [root.controller, "status"]
    stdout: StdioCollector {
      onStreamFinished: {
        try { root.acceptStatus(JSON.parse(text)) }
        catch (error) { root.disconnect() }
      }
    }
    onExited: (code, status) => {
      if (code !== 0) root.disconnect()
    }
  }
  Process {
    id: action
    stderr: StdioCollector { onStreamFinished: { if (text.trim()) root.errorMessage = text.trim() } }
    onExited: (code, status) => { root.poll() }
  }
  Process { id: launcher; command: [Quickshell.env("HOME") + "/.local/bin/dailyxp"] }
  Timer { id: feedbackExpiry; interval: 2500; onTriggered: root.feedback = "" }
  Timer { interval: 2000; repeat: true; running: true; triggeredOnStart: true; onTriggered: root.poll() }
}
