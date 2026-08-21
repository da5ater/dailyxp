import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "EventModel.js" as EventModel
import "HabitJournal.js" as HabitJournal
import "HabitModel.js" as HabitModel
import "PlanningJournal.js" as PlanningJournal
import "PlanningModel.js" as PlanningModel
import "SessionJournal.js" as SessionJournal
import "SessionModel.js" as SessionModel
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
  property var sessionProjection: SessionModel.emptyProjection()
  property var sessionConfirmation: null
  property var habitProjection: HabitModel.emptyProjection()
  property string systemTimezone: ""
  readonly property bool recordingReady: journalReady && systemTimezone !== ""
  property bool ready: false
  property bool saving: false
  property string errorMessage: ""
  property string notifiedSelectionKey: ""
  property string _reminderAction: ""
  readonly property int configuredDayBoundaryMinutes: dayBoundaryMinutesFromConfig()
  readonly property int configuredSelectionReminderMinutes: integerSetting("selectionReminderMinutes", 10, 0, 1440)
  readonly property int configuredInactivitySeconds: integerSetting("inactivitySeconds", 300, 60, 86400)

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

  function integerSetting(name, fallback, minimum, maximum) {
    var value = Number(pluginSettings()[name])
    return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback
  }

  function acceptTimezonePath(raw) {
    var path = String(raw || "").trim()
    var marker = "/zoneinfo/"
    var index = path.indexOf(marker)
    var zone = index >= 0 ? path.slice(index + marker.length) : ""
    if (EventModel.isIanaTimezone(zone)) {
      systemTimezone = zone
      ensureCurrentPlanningDay()
      ensureCurrentHabitDay()
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
    sessionProjection = SessionModel.project(journal.events)
    habitProjection = HabitModel.project(journal.events)
    journalReady = true
    ensureCurrentPlanningDay()
    ensureCurrentHabitDay()
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

  function sessionDailyXpDate(atUtc) {
    var localContext = EventModel.localSystemContext(new Date(atUtc), systemTimezone)
    return EventModel.dailyXpDate(localContext.localDateTime, configuredDayBoundaryMinutes)
  }

  function planningTask(taskId) {
    if (taskId === null || taskId === undefined) return null
    var tasks = planningProjection.tasks || []
    for (var i = 0; i < tasks.length; i += 1) if (tasks[i].id === taskId) return tasks[i]
    return null
  }

  function planningTaskExists(taskId) {
    return taskId === null || taskId === undefined || planningTask(taskId) !== null
  }

  function validateSessionTaskReferences(command) {
    var taskId = null
    if (command.type === "selection.change" || command.type === "session.change_task") taskId = command.taskId
    else if (command.type === "session.start" && command.session) taskId = command.session.taskId
    else if (command.type === "session.correct" && command.changes &&
        command.changes.taskId !== undefined) taskId = command.changes.taskId
    if (!planningTaskExists(taskId)) throw new Error("taskId must reference a current Task")
  }

  function applySessionCommand(command) {
    if (!ready || !recordingReady || saving) return false
    try {
      var input = JSON.parse(JSON.stringify(command || ({})))
      validateSessionTaskReferences(input)
      if (input.type === "selection.change" && input.reminderDelayMinutes === undefined)
        input.reminderDelayMinutes = configuredSelectionReminderMinutes
      if (input.type === "session.change_task" && input.taskId !== null) {
        var changedTask = planningTask(input.taskId)
        input.primarySkill = changedTask.primarySkill
      }
      if (input.type === "session.finish" && input.dailySlices === undefined && sessionProjection.activeSession) {
        input.sliceContext = {
          timezone: systemTimezone, dayBoundaryMinutes: configuredDayBoundaryMinutes
        }
        input.dailySlices = SessionModel.dailySlicesAt(sessionProjection.activeSession, input.atUtc,
          function(atUtc) { return root.sessionDailyXpDate(atUtc) })
        var correctionHorizonUtc = new Date(
          new Date(input.atUtc).getTime() + 24 * 60 * 60000).toISOString()
        input.sliceTimeline = SessionModel.dailyXpTimelineAt(
          sessionProjection.activeSession.startedAtUtc, correctionHorizonUtc,
          function(atUtc) { return root.sessionDailyXpDate(atUtc) })
      }
      if (input.type === "session.correct" && input.dailySlices === undefined) {
        var correctedSession = null
        var sessions = sessionProjection.sessions || []
        for (var i = 0; i < sessions.length; i += 1)
          if (sessions[i].id === input.id) correctedSession = sessions[i]
        var correctedFocused = 0
        var correctedSegments = input.segments || []
        for (var s = 0; s < correctedSegments.length; s += 1)
          correctedFocused += new Date(correctedSegments[s].endedAtUtc).getTime() -
            new Date(correctedSegments[s].startedAtUtc).getTime()
        input.sliceContext = correctedSession ? correctedSession.sliceContext : null
        input.dailySlices = correctedSession && correctedSession.sliceTimeline &&
          correctedSession.sliceTimeline.length > 0
          ? SessionModel.dailySlicesFromTimeline(correctedSegments, correctedSession.sliceTimeline)
          : correctedSession && correctedSession.dailySlices && correctedSession.dailySlices.length > 0
          ? SessionModel.revisedDailySlices(correctedSession.dailySlices, correctedFocused)
          : SessionModel.dailySlicesAt({ segments: correctedSegments, inactiveIntervals: [] },
            input.atUtc, function(atUtc) { return root.sessionDailyXpDate(atUtc) })
      }
      var result = SessionModel.decide(sessionProjection, input)
      sessionConfirmation = result.confirmation || null
      if (result.events.length === 0) return true
      var now = new Date()
      var localContext = EventModel.localSystemContext(now, systemTimezone)
      var nextJournal = SessionJournal.appendIntents(journal, result.events, {
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
      errorMessage = "Could not update DailyXP Session: " + error
      console.warn("dailyxp/session", errorMessage)
      return false
    }
  }

  function handleSessionInactivity() {
    var active = sessionProjection.activeSession
    if (!active || active.status !== "running") return
    var nowUtc = new Date().toISOString()
    if (sessionIdleMonitor.isIdle && !active.pendingInactivityStartedAtUtc)
      applySessionCommand({ type: "session.inactivity.detect", atUtc: nowUtc })
    else if (!sessionIdleMonitor.isIdle && active.pendingInactivityStartedAtUtc &&
        !active.pendingInactivityEndedAtUtc)
      applySessionCommand({ type: "session.inactivity.return", atUtc: nowUtc })
  }

  function checkSelectionReminder() {
    var selection = sessionProjection.selection
    if (!selection) return
    if (selection.reminderStatus === "scheduled") {
      var nowUtc = new Date().toISOString()
      if (new Date(nowUtc).getTime() < new Date(selection.reminderDueAtUtc).getTime()) return
      applySessionCommand({ type: "selection.reminder.due", atUtc: nowUtc })
      return
    }
    if (selection.reminderStatus !== "due" || notifiedSelectionKey === selection.selectedAtUtc ||
        selectionReminderProcess.running) return
    var task = planningTask(selection.taskId)
    _reminderAction = ""
    notifiedSelectionKey = selection.selectedAtUtc
    selectionReminderProcess.command = [
      "notify-send", "--app-name=DailyXP", "--urgency=normal", "--expire-time=0",
      "--action=start=Start", "--action=change=Change Task", "--action=dismiss=Dismiss",
      "Ready to focus?", task ? task.title : "Your selected Task is waiting."
    ]
    selectionReminderProcess.running = true
  }

  function handleSelectionReminderAction(action, exitCode) {
    var selectedAction = String(action || "").trim()
    var selection = sessionProjection.selection
    if (!selection || selection.reminderStatus !== "due") return
    if (exitCode !== 0) {
      notifiedSelectionKey = ""
      errorMessage = "Could not show the DailyXP reminder"
      console.warn("dailyxp/reminder", errorMessage)
      return
    }
    if (selectedAction === "start") {
      var task = planningTask(selection.taskId)
      if (!task) return
      applySessionCommand({ type: "session.start", session: {
        id: EventModel.uuidV4(), taskId: task.id, primarySkill: task.primarySkill,
        plannedMinutes: task.estimateMinutes, startedAtUtc: new Date().toISOString()
      } })
    } else if (selectedAction === "change") {
      Quickshell.execDetached(["omarchy-shell", "shell", "summon", "io.github.da5ater.dailyxp", "{}"])
    } else {
      applySessionCommand({ type: "selection.reminder.dismiss", atUtc: new Date().toISOString() })
    }
  }

  function ensureCurrentPlanningDay() {
    if (!ready || !recordingReady || saving) return false
    var now = new Date()
    var localContext = EventModel.localSystemContext(now, systemTimezone)
    var dailyXpDate = EventModel.dailyXpDate(localContext.localDateTime, configuredDayBoundaryMinutes)
    return applyPlanningCommand({ type: "day.advance", dailyXpDate: dailyXpDate })
  }

  function ensureCurrentHabitDay() {
    if (!ready || !recordingReady || saving) return false
    var now = new Date()
    var localContext = EventModel.localSystemContext(now, systemTimezone)
    var dailyXpDate = EventModel.dailyXpDate(localContext.localDateTime, configuredDayBoundaryMinutes)
    return applyHabitCommand({ type: "habit.day.advance", dailyXpDate: dailyXpDate })
  }

  function applyHabitCommand(command) {
    if (!ready || !recordingReady || saving) return false
    try {
      var result = HabitModel.decide(habitProjection, command)
      if (result.events.length === 0) return true
      var now = new Date()
      var localContext = EventModel.localSystemContext(now, systemTimezone)
      var nextJournal = HabitJournal.appendIntents(journal, result.events, {
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
      errorMessage = "Could not update DailyXP habit: " + error
      console.warn("dailyxp/habit", errorMessage)
      return false
    }
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

  Process {
    id: selectionReminderProcess
    running: false
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root._reminderAction = text
    }
    onExited: function(exitCode) {
      root.handleSelectionReminderAction(root._reminderAction, exitCode)
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
      root.sessionProjection = root._pendingJournal
        ? SessionModel.project(root._pendingJournal.events) : SessionModel.emptyProjection()
      root.habitProjection = root._pendingJournal
        ? HabitModel.project(root._pendingJournal.events) : HabitModel.emptyProjection()
      root.journalReady = true
      root._primaryRaw = root._pendingPrimaryRaw
      root._pendingEnvelope = null
      root._pendingJournal = null
      root._pendingPrimaryRaw = ""
      root.saving = false
      root.persisted()
      Qt.callLater(root.ensureCurrentPlanningDay)
      Qt.callLater(root.ensureCurrentHabitDay)
      Qt.callLater(root.checkSelectionReminder)
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
    onTriggered: {
      root.ensureCurrentPlanningDay()
      root.ensureCurrentHabitDay()
    }
  }

  IdleMonitor {
    id: sessionIdleMonitor
    enabled: root.ready && root.sessionProjection.activeSession &&
      root.sessionProjection.activeSession.status === "running"
    timeout: root.configuredInactivitySeconds
    respectInhibitors: true
    onIsIdleChanged: root.handleSessionInactivity()
  }

  Timer {
    interval: 15000
    repeat: true
    running: root.ready
    triggeredOnStart: false
    onTriggered: {
      root.checkSelectionReminder()
      root.handleSessionInactivity()
    }
  }

  Component.onCompleted: {
    ensureStateDir.running = true
    timezonePathProcess.running = true
  }
}
