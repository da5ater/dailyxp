import QtQuick
import Quickshell
import Quickshell.Io
import "StateModel.js" as StateModel

Item {
  id: root

  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || home + "/.local/state"
  readonly property string stateDir: stateHome + "/dailyxp"
  readonly property string primaryPath: stateDir + "/state.json"
  readonly property string backupPath: stateDir + "/state.backup.json"

  property var envelope: StateModel.createEnvelope(StateModel.emptyPayload(), 0)
  readonly property int probeCount: envelope.payload.probeEvents.length
  property bool ready: false
  property bool saving: false
  property string errorMessage: ""

  property string _primaryRaw: ""
  property string _backupRaw: ""
  property bool _primaryRead: false
  property bool _backupRead: false
  property var _pendingEnvelope: null
  property string _pendingPrimaryRaw: ""

  signal persisted()

  function acceptPrimary(raw) {
    _primaryRaw = String(raw || "")
    _primaryRead = true
    finishLoad()
  }

  function acceptBackup(raw) {
    _backupRaw = String(raw || "")
    _backupRead = true
    finishLoad()
  }

  function finishLoad() {
    if (ready || !_primaryRead || !_backupRead) return
    envelope = StateModel.recover(_primaryRaw, _backupRaw)
    ready = true
  }

  function addProbe() {
    if (!ready || saving) return
    var eventId = "probe-" + Date.now() + "-" + Math.floor(Math.random() * 1000000000)
    var next = StateModel.addProbeEvent(envelope, eventId)
    if (next === envelope) return

    var plan = StateModel.savePlan(envelope, next)
    _pendingEnvelope = next
    _pendingPrimaryRaw = plan.primaryRaw
    saving = true
    errorMessage = ""
    backupFile.setText(plan.backupRaw)
  }

  function failSave(stage, error) {
    saving = false
    _pendingEnvelope = null
    _pendingPrimaryRaw = ""
    errorMessage = "Could not save DailyXP state (" + stage + ": " + error + ")"
    console.warn("dailyxp/state", errorMessage)
  }

  Process {
    id: ensureStateDir
    command: ["mkdir", "-p", root.stateDir]
    running: false
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        root.errorMessage = "Could not create " + root.stateDir
        console.warn("dailyxp/state", root.errorMessage)
        return
      }
      root._primaryRead = false
      root._backupRead = false
      primaryFile.reload()
      backupFile.reload()
    }
  }

  FileView {
    id: primaryFile
    path: root.primaryPath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.acceptPrimary(text())
    onLoadFailed: function(error) { root.acceptPrimary("") }
    onSaved: {
      if (!root.saving || !root._pendingEnvelope) return
      root.envelope = root._pendingEnvelope
      root._primaryRaw = root._pendingPrimaryRaw
      root._pendingEnvelope = null
      root._pendingPrimaryRaw = ""
      root.saving = false
      root.persisted()
    }
    onSaveFailed: function(error) { root.failSave("primary", error) }
  }

  FileView {
    id: backupFile
    path: root.backupPath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.acceptBackup(text())
    onLoadFailed: function(error) { root.acceptBackup("") }
    onSaved: {
      if (root.saving && root._pendingPrimaryRaw !== "")
        primaryFile.setText(root._pendingPrimaryRaw)
    }
    onSaveFailed: function(error) { root.failSave("backup", error) }
  }

  Component.onCompleted: ensureStateDir.running = true
}
