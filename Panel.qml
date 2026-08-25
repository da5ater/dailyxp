import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "EventModel.js" as EventModel
import "SessionModel.js" as SessionModel
import "ShareModel.js" as ShareModel
import "ProgressionModel.js" as ProgressionModel
import "StoryModel.js" as StoryModel
import "UxModel.js" as UxModel

Panel {
  id: root
  moduleName: "io.github.da5ater.dailyxp"
  ipcTarget: moduleName
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var stateStore: null
  property bool usePlannedDuration: true
  property var pendingCorrectionCommand: null
  property int correctionSessionOffset: 0
  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family
  property string nowUtc: new Date().toISOString()
  readonly property var activeSession: stateStore ? stateStore.sessionProjection.activeSession : null
  readonly property var selection: stateStore ? stateStore.sessionProjection.selection : null
  readonly property var recentSession: correctionSession()

  readonly property var progressionProjection: stateStore ? stateStore.progressionProjection : null
  function progressionPreview(entry) {
    if (!entry) return ""
    try { return ProgressionModel.previewFor(entry) } catch (e) { return entry.reason || "" }
  }
  function progressionLevelText() {
    var proj = progressionProjection
    if (!proj) return "Level 1 \u00b7 Wanderer"
    return "Level " + proj.level + " \u00b7 " + proj.storyRank
  }
  function progressionTotalsText() {
    var proj = progressionProjection
    if (!proj || !proj.totals) return "0 Lifetime \u00b7 0 Season"
    return proj.totals.lifetimeXp + " Lifetime \u00b7 " + proj.totals.seasonXp + " Season"
  }
  readonly property var storyProjection: stateStore ? stateStore.storyProjection : null
  function provinceLabel(status) {
    if (status === "achieved") return "visitable"
    if (status === "sleeping") return "sleeping"
    if (status === "ruins") return "Ruins"
    return "active"
  }
  readonly property var recoveryProjection: stateStore ? stateStore.recoveryProjection : null
  readonly property var uxProjection: stateStore ? stateStore.uxProjection : null
  readonly property var habitProjection: stateStore ? stateStore.habitProjection : null
  readonly property var planningProjection: stateStore ? stateStore.planningProjection : null
  property bool playOverdueExpanded: false
  function currentSurface() { return uxProjection ? uxProjection.currentSurface : "Play" }
  function isSheetOpen(sheetId) { return uxProjection && uxProjection.sheets ? uxProjection.sheets.indexOf(sheetId) !== -1 : false }
  function toggleSheet(sheetId) {
    if (!stateStore) return
    var open = isSheetOpen(sheetId)
    stateStore.applyUxCommand({ type: open ? "ux.sheet.close" : "ux.sheet.open", sheetId: sheetId })
  }
  function todayOccurrences() {
    if (!planningProjection || !planningProjection.occurrences) return []
    var today = planningProjection.lastAdvancedDailyXpDate
    if (!today) return []
    var out = []
    for (var i = 0; i < planningProjection.occurrences.length; i++) {
      var o = planningProjection.occurrences[i]
      if (o.dailyXpDate === today && (o.status === "open" || o.status === "completed")) out.push(o)
    }
    return out
  }
  function overdueOccurrences() {
    if (!planningProjection || !planningProjection.occurrences) return []
    var out = []
    for (var i = 0; i < planningProjection.occurrences.length; i++) {
      var o = planningProjection.occurrences[i]
      if (o.status === "overdue") out.push(o)
    }
    return out
  }
  readonly property var sessionSummary: activeSession
    ? SessionModel.summaryAt(stateStore.sessionProjection, nowUtc) : null

  function selectedTask() {
    if (!selection || !stateStore) return null
    var tasks = stateStore.planningProjection.tasks || []
    for (var i = 0; i < tasks.length; i += 1) if (tasks[i].id === selection.taskId) return tasks[i]
    return null
  }

  function selectTask(task) {
    stateStore.applySessionCommand({
      type: "selection.change", taskId: task.id, selectedAtUtc: new Date().toISOString()
    })
  }

  function startSession(forceFree) {
    var task = forceFree === true ? null : selectedTask()
    var freePlanned = Number(freePlanField.text)
    var freePlannedMinutes = Number.isInteger(freePlanned) && freePlanned > 0 ? freePlanned : null
    stateStore.applySessionCommand({
      type: "session.start",
      session: {
        id: EventModel.uuidV4(),
        taskId: task ? task.id : null,
        primarySkill: task ? task.primarySkill : "general/focus",
        plannedMinutes: task ? (usePlannedDuration ? task.estimateMinutes : null) : freePlannedMinutes,
        startedAtUtc: new Date().toISOString()
      }
    })
  }

  function sessionTransition(type) {
    stateStore.applySessionCommand({ type: type, atUtc: new Date().toISOString() })
  }

  function finishSession(plannedDecision, acknowledgeCap) {
    stateStore.applySessionCommand({
      type: "session.finish",
      atUtc: new Date().toISOString(),
      plannedDurationDecision: plannedDecision || undefined,
      inactivityDecision: activeSession && activeSession.inactiveIntervals.length > 0 ? "exclude" : undefined,
      dailyCapAcknowledged: acknowledgeCap === true
    })
  }

  function hasConfirmationReason(reason) {
    var confirmation = stateStore ? stateStore.sessionConfirmation : null
    return confirmation && confirmation.reasons && confirmation.reasons.indexOf(reason) !== -1
  }

  function confirmationText() {
    var confirmation = stateStore ? stateStore.sessionConfirmation : null
    if (!confirmation) return ""
    var messages = []
    if (hasConfirmationReason("planned-duration"))
      messages.push("The planned duration passed. Choose whether overtime receives competitive credit.")
    if (hasConfirmationReason("daily-cap")) {
      var excluded = Number(confirmation.dailyCapExcludedMilliseconds || 0) / 60000
      messages.push("The 12-hour daily cap excludes " + excluded + " minutes from competitive credit. Focused history stays intact.")
    }
    if (hasConfirmationReason("correction")) {
      var delta = Number(confirmation.competitiveDeltaMilliseconds || 0) / 60000
      messages.push("This correction changes competitive time by " + (delta > 0 ? "+" : "") + delta + " minutes.")
    }
    return messages.length > 0 ? messages.join(" ")
      : "Focused time needs your confirmation before competitive credit changes."
  }

  function cycleActiveTask() {
    if (!activeSession || !stateStore) return
    var tasks = stateStore.planningProjection.tasks || []
    var nextTaskId = null
    if (activeSession.taskId === null && tasks.length > 0) nextTaskId = tasks[0].id
    else for (var i = 0; i < tasks.length; i += 1)
      if (tasks[i].id === activeSession.taskId && i + 1 < tasks.length) nextTaskId = tasks[i + 1].id
    stateStore.applySessionCommand({
      type: "session.change_task", taskId: nextTaskId, atUtc: new Date().toISOString()
    })
  }

  function correctionSession() {
    if (!stateStore) return null
    var sessions = stateStore.sessionProjection.sessions || []
    var finished = []
    for (var i = sessions.length - 1; i >= 0; i -= 1)
      if (sessions[i].status === "finished") finished.push(sessions[i])
    return correctionSessionOffset < finished.length ? finished[correctionSessionOffset] : null
  }

  function finishedSessionCount() {
    if (!stateStore) return 0
    var sessions = stateStore.sessionProjection.sessions || []
    var count = 0
    for (var i = 0; i < sessions.length; i += 1)
      if (sessions[i].status === "finished") count += 1
    return count
  }

  function correctionCommand(deltaMinutes, changes, exactMilliseconds) {
    if (!recentSession || recentSession.status !== "finished") return null
    var segments = JSON.parse(JSON.stringify(
      SessionModel.focusedSegments(recentSession, recentSession.finishedAtUtc)))
    if (segments.length === 0) return null
    var targetMilliseconds = exactMilliseconds === undefined
      ? recentSession.focusedMilliseconds + deltaMinutes * 60000 : exactMilliseconds
    try {
      segments = SessionModel.resizeFocusedSegments(
        segments, targetMilliseconds, new Date().toISOString())
    } catch (error) {
      return null
    }
    return {
      type: "session.correct", id: recentSession.id, atUtc: new Date().toISOString(),
      segments: segments, changes: changes
    }
  }

  function requestCorrection(deltaMinutes, changes, exactMilliseconds) {
    pendingCorrectionCommand = correctionCommand(deltaMinutes, changes, exactMilliseconds)
    if (!pendingCorrectionCommand) return
    stateStore.applySessionCommand(pendingCorrectionCommand)
    if (!stateStore.sessionConfirmation) pendingCorrectionCommand = null
  }

  function correctionTaskChange() {
    if (!recentSession || !stateStore) return
    var tasks = stateStore.planningProjection.tasks || []
    var nextTask = null
    if (recentSession.taskId === null && tasks.length > 0) nextTask = tasks[0]
    else for (var i = 0; i < tasks.length; i += 1)
      if (tasks[i].id === recentSession.taskId && i + 1 < tasks.length) nextTask = tasks[i + 1]
    requestCorrection(0, {
      taskId: nextTask ? nextTask.id : null,
      primarySkill: nextTask ? nextTask.primarySkill : "general/focus"
    })
  }

  function correctionPlannedChange(deltaMinutes) {
    if (!recentSession) return
    var current = recentSession.plannedMinutes === null ? 0 : recentSession.plannedMinutes
    var revised = Math.max(0, current + deltaMinutes)
    requestCorrection(0, { plannedMinutes: revised === 0 ? null : revised })
  }

  function requestExactCorrection(durationText, skillText, plannedText) {
    if (!recentSession) return
    var targetMinutes = Number(durationText)
    if (!isFinite(targetMinutes) || targetMinutes <= 0) return
    var skill = String(skillText || "").trim()
    var planned = String(plannedText || "").trim().toLowerCase()
    var changes = ({})
    if (skill !== "") changes.primarySkill = skill
    if (planned === "open") changes.plannedMinutes = null
    else if (planned !== "") {
      var plannedMinutes = Number(planned)
      if (!Number.isInteger(plannedMinutes) || plannedMinutes < 1) return
      changes.plannedMinutes = plannedMinutes
    }
    var targetMilliseconds = targetMinutes * 60000
    if (!Number.isInteger(targetMilliseconds)) return
    requestCorrection(0, changes, targetMilliseconds)
  }

  function continueCorrection(plannedDecision, confirmCompetitiveChange) {
    if (!pendingCorrectionCommand) return
    var command = JSON.parse(JSON.stringify(pendingCorrectionCommand))
    if (plannedDecision !== undefined) command.plannedDurationDecision = plannedDecision
    if (confirmCompetitiveChange === true) command.competitiveChangeConfirmed = true
    pendingCorrectionCommand = command
    stateStore.applySessionCommand(command)
    if (!stateStore.sessionConfirmation) pendingCorrectionCommand = null
  }

  function formatElapsed(milliseconds) {
    var totalSeconds = Math.floor(Number(milliseconds || 0) / 1000)
    var hours = Math.floor(totalSeconds / 3600)
    var minutes = Math.floor((totalSeconds % 3600) / 60)
    var seconds = totalSeconds % 60
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" +
      String(seconds).padStart(2, "0")
  }

  function statusText() {
    if (activeSession) return formatElapsed(sessionSummary.focusedMilliseconds)
    if (!selection) return "Selection declares intent. Time starts only when you press Start."
    var task = selectedTask()
    return "Selected: " + (task ? task.title : selection.taskId)
  }

  function startButtonText() {
    if (!selection) return "Start free Session"
    if (selection.reminderStatus === "due") return "Start selected Session"
    return "Start selected"
  }

  function plannedModeText() {
    var task = selectedTask()
    if (!task) return "Open-ended Session"
    return usePlannedDuration ? "Planned: " + task.estimateMinutes + " minutes" : "Open-ended Session"
  }

  function recentSessionText() {
    if (!recentSession) return ""
    var revision = recentSession.lastRevisionKind ? " · " + recentSession.lastRevisionKind : ""
    return "Session " + recentSession.id.slice(0, 8) + " · " +
      formatElapsed(recentSession.focusedMilliseconds) + revision
  }

  function open() {
    root.controller.show()
    Qt.callLater(function() {
      if (root.opened && root.bar && "centerHoverRevealSuppressed" in root.bar)
        root.bar.centerHoverRevealSuppressed = true
    })
  }

  function close() {
    if (root.bar && "centerHoverRevealSuppressed" in root.bar)
      root.bar.centerHoverRevealSuppressed = false
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  // Apple: material + spatial consistency (enter/exit same path, anchored to trigger), Gaming: staging + appeal, Animate: spatial 220-420ms ease-out
  readonly property bool _reducedMotion: (uxProjection && uxProjection.reducedMotion) ? true : false
  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(420))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)
    // Apple: symmetric spring, interruptible from presentation value, materialize (blur+scale not just opacity)
    Behavior on contentWidth { enabled: !_reducedMotion; NumberAnimation { duration: 280; easing.type: Easing.OutCubic } }
    Behavior on contentHeight { enabled: !_reducedMotion; NumberAnimation { duration: 280; easing.type: Easing.OutCubic } }

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: false
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      // Phase R (#93): the catcher holds Keys.BeforeItem priority, so every
      // Up/Down/h/j press landed here and died — no consumer existed. Route
      // them into the shell's viewport scroll (48px per step).
      onMoveRequested: function(dx, dy) { phaseShell.scrollBy(dy * 48) }

      // Apple material: translucent layer, content scrolls underneath, not opaque bar; Gaming: hero staging
      Rectangle {
        id: materialBg
        anchors.fill: parent
        anchors.margins: -Style.space(12)
        color: Qt.rgba(0.05, 0.07, 0.14, 0.72) // midnight navy 72% + warm gold hint for permanent progress
        radius: Style.space(16)
        border.color: Qt.rgba(1,1,1,0.08)
        // blur approximation: opacity fade + scale materialize (real backdrop-filter via layer when available)
        opacity: 1.0
        scale: 1.0
        visible: !_reducedMotion || true
        Behavior on opacity { enabled: !_reducedMotion; NumberAnimation { duration: 220; easing.type: Easing.OutCubic } }
        Behavior on scale { enabled: !_reducedMotion; NumberAnimation { duration: 320; easing.type: Easing.OutCubic } }
      }

      // ── Phase R shell (#93 V1): the arcade cockpit ──────────────
      // In-place gut: the entire legacy content block is replaced by
      // ShellContent (host-independent arcade shell). Host contract above
      // (popup plumbing, KeyboardPanel, open/close/switchPanelFrom) and the
      // session tick timer below are preserved verbatim.
      Item {
        id: content
        width: parent.width
        implicitHeight: phaseShell.implicitHeight

        ShellContent {
          id: phaseShell
          anchors.horizontalCenter: parent.horizontalCenter
          width: Math.min(parent.width, 420)

          // V2 (#94): the real engine bridge — screens read
          // shellApi.stateStore for planningProjection + applyPlanningCommand.
          stateStore: root.stateStore

          // R8 focus chain: when the panel opens, focus moves from the host
          // keyCatcher into the shell's controller; Esc bubbles back up via
          // the shell's Keys.escapePressed default (accept=false falls through).
          Connections {
            target: root
            function onOpenedChanged() {
              if (root.opened) phaseShell.forceControllerFocus()
            }
          }
        }
      }
    }
  }

  Timer {
    interval: 1000
    repeat: true
    running: root.opened && root.activeSession && root.activeSession.status === "running"
    triggeredOnStart: true
    onTriggered: root.nowUtc = new Date().toISOString()
  }
}
