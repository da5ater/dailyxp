import QtQuick
import Quickshell
import Quickshell.Io
import "EventModel.js" as EventModel
import "PlanningJournal.js" as PlanningJournal
import "PlanningModel.js" as PlanningModel
import "StateModel.js" as StateModel

Item {
  id: root

  // Injected once by the Omarchy service host.
  property var shell: null
  readonly property string home: Quickshell.env("HOME") || ""
  readonly property string stateHome: Quickshell.env("XDG_STATE_HOME") || home + "/.local/state"
  readonly property string stateDir: stateHome + "/dailyxp"
  readonly property string primaryPath: stateDir + "/state.json"
  readonly property string backupPath: stateDir + "/state.backup.json"

  property var envelope: StateModel.createEnvelope(StateModel.emptyPayload(), 0)
  readonly property int probeCount: envelope.payload.probeEvents.length
  property var journal: null
  property bool journalReady: false
  property var planningProjection: PlanningModel.emptyProjection()
  property var proposalPreview: null
  property string systemTimezone: ""
  readonly property bool recordingReady: journalReady && systemTimezone !== ""
  property bool ready: false
  property bool saving: false
  property string errorMessage: ""
  readonly property int configuredDayBoundaryMinutes: dayBoundaryMinutesFromConfig()

  property string _primaryRaw: ""
  property string _backupRaw: ""
  property bool _primaryRead: false
  property bool _backupRead: false
  property var _pendingEnvelope: null
  property var _pendingJournal: null
  property string _pendingPrimaryRaw: ""

  signal persisted()

  function pluginSettings() {
    var config = shell && shell.shellConfig ? shell.shellConfig : null
    if (!config) return ({})
    var layout = config.bar && config.bar.layout ? config.bar.layout : ({})
    var sections = ["left", "center", "right"]
    for (var s = 0; s < sections.length; s += 1) {
      var entries = Array.isArray(layout[sections[s]]) ? layout[sections[s]] : []
      for (var i = 0; i < entries.length; i += 1)
        if (entries[i] && entries[i].id === "io.github.da5ater.dailyxp") return entries[i]
    }
    var plugins = Array.isArray(config.plugins) ? config.plugins : []
    for (var p = 0; p < plugins.length; p += 1)
      if (plugins[p] && plugins[p].id === "io.github.da5ater.dailyxp") return plugins[p]
    return ({})
  }

  function dayBoundaryMinutesFromConfig() {
    var value = Number(pluginSettings().dayBoundaryMinutes)
    return Number.isInteger(value) && value >= 0 && value <= 1439 ? value : 240
  }

  function acceptTimezonePath(raw) {
    var path = String(raw || "").trim()
    var marker = "/zoneinfo/"
    var index = path.indexOf(marker)
    var zone = index >= 0 ? path.slice(index + marker.length) : ""
    if (EventModel.isIanaTimezone(zone)) {
      systemTimezone = zone
      ensureCurrentPlanningDay()
      return
    }
    if (errorMessage === "") errorMessage = "Could not determine the system IANA timezone from /etc/localtime"
    console.warn("dailyxp/state", errorMessage)
  }

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
    var recovered = StateModel.recoverDetailed(_primaryRaw, _backupRaw)
    envelope = recovered.envelope
    ready = true
    if (recovered.error !== "") {
      errorMessage = recovered.error
      console.warn("dailyxp/state", errorMessage)
      return
    }
    loadJournal()
  }

  function loadJournal() {
    var raw = envelope.payload.eventJournalRaw
    if (raw === undefined || raw === "") {
      var created = EventModel.createJournal(EventModel.uuidV4())
      persistNext(StateModel.withEventJournal(envelope, EventModel.exportJournal(created)), created)
      return
    }

    var loaded = EventModel.loadJournal(raw)
    if (!loaded.ok) {
      journalReady = false
      errorMessage = loaded.message
      console.warn("dailyxp/state", errorMessage)
      return
    }

    if (loaded.migrated) {
      persistNext(StateModel.withEventJournal(envelope, EventModel.exportJournal(loaded.journal)), loaded.journal)
      return
    }
    journal = loaded.journal
    planningProjection = PlanningModel.project(journal.events)
    journalReady = true
    ensureCurrentPlanningDay()
  }

  function persistNext(nextEnvelope, nextJournal) {
    if (saving || nextEnvelope === envelope) return false
    var plan = StateModel.savePlan(envelope, nextEnvelope)
    _pendingEnvelope = nextEnvelope
    _pendingJournal = nextJournal
    _pendingPrimaryRaw = plan.primaryRaw
    saving = true
    errorMessage = ""
    backupFile.setText(plan.backupRaw)
    return true
  }

  function addProbe() {
    if (!ready || !recordingReady || saving) return
    try {
      var now = new Date()
      var nowUtc = now.toISOString()
      var localContext = EventModel.localSystemContext(now, systemTimezone)
      var eventId = EventModel.uuidV4()
      var domainEvent = EventModel.createEvent({
        eventId: eventId,
        deviceId: journal.deviceId,
        type: "foundation.probed",
        occurredAtUtc: nowUtc,
        localDateTime: localContext.localDateTime,
        timezone: localContext.timezone,
        utcOffsetMinutes: localContext.utcOffsetMinutes,
        systemTimezoneVerified: true,
        dayBoundaryMinutes: configuredDayBoundaryMinutes,
        occurrenceKey: null,
        payload: { probeId: eventId }
      })
      var nextJournal = EventModel.append(journal, domainEvent)
      var nextEnvelope = StateModel.recordProbe(envelope, eventId, EventModel.exportJournal(nextJournal))
      persistNext(nextEnvelope, nextJournal)
    } catch (error) {
      errorMessage = "Could not record DailyXP event: " + error
      console.warn("dailyxp/state", errorMessage)
    }
  }

  function applyPlanningCommand(command) {
    if (!ready || !recordingReady || saving) return false
    try {
      var result = PlanningModel.decide(planningProjection, command)
      proposalPreview = result.preview || null
      if (result.events.length === 0) return true
      var now = new Date()
      var localContext = EventModel.localSystemContext(now, systemTimezone)
      var nextJournal = PlanningJournal.appendIntents(journal, result.events, {
        occurredAtUtc: now.toISOString(),
        localDateTime: localContext.localDateTime,
        timezone: localContext.timezone,
        utcOffsetMinutes: localContext.utcOffsetMinutes,
        systemTimezoneVerified: true,
        dayBoundaryMinutes: configuredDayBoundaryMinutes
      }, EventModel)
      var nextEnvelope = StateModel.withEventJournal(envelope, EventModel.exportJournal(nextJournal))
      return persistNext(nextEnvelope, nextJournal)
    } catch (error) {
      errorMessage = "Could not update DailyXP plan: " + error
      console.warn("dailyxp/planning", errorMessage)
      return false
    }
  }

  function ensureCurrentPlanningDay() {
    if (!ready || !recordingReady || saving) return false
    var now = new Date()
    var localContext = EventModel.localSystemContext(now, systemTimezone)
    var dailyXpDate = EventModel.dailyXpDate(localContext.localDateTime, configuredDayBoundaryMinutes)
    return applyPlanningCommand({ type: "day.advance", dailyXpDate: dailyXpDate })
  }

  function failSave(stage, error) {
    saving = false
    _pendingEnvelope = null
    _pendingJournal = null
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

  Process {
    id: timezonePathProcess
    command: ["readlink", "-f", "/etc/localtime"]
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.acceptTimezonePath(text)
    }
    onExited: function(exitCode) {
      if (exitCode !== 0 && root.systemTimezone === "") root.acceptTimezonePath("")
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
      root.journal = root._pendingJournal
      root.planningProjection = root._pendingJournal
        ? PlanningModel.project(root._pendingJournal.events) : PlanningModel.emptyProjection()
      root.journalReady = true
      root._primaryRaw = root._pendingPrimaryRaw
      root._pendingEnvelope = null
      root._pendingJournal = null
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

  Timer {
    interval: 60000
    repeat: true
    running: root.ready
    triggeredOnStart: false
    onTriggered: root.ensureCurrentPlanningDay()
  }

  Component.onCompleted: {
    ensureStateDir.running = true
    timezonePathProcess.running = true
  }
}
