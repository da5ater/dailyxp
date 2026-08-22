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
      blocked: freePlanField.activeFocus || correctionDuration.activeFocus ||
        correctionSkill.activeFocus || correctionPlanned.activeFocus
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

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

      ColumnLayout {
        id: content
        width: parent.width
        spacing: Style.space(12)
        // Apple typography: tighten display, loosen body, respect Dynamic Type via rem
        Text {
          text: root.activeSession ? "Focused Session" : "Choose what matters now"
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.title
          font.bold: true
          // tracking: -0.02em for display, leading 1.05
          font.letterSpacing: -0.3
          lineHeight: 1.05
          Layout.alignment: Qt.AlignHCenter
          // Gaming: anticipation — subtle scale-in on title change
          opacity: 1.0
          scale: 1.0
          Behavior on opacity { enabled: !_reducedMotion; NumberAnimation { duration: 180; easing.type: Easing.OutCubic } }
          Behavior on scale { enabled: !_reducedMotion; NumberAnimation { duration: 320; easing.type: Easing.OutCubic } }
        }

        Text {
          text: root.statusText()
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.body
          Layout.alignment: Qt.AlignHCenter
          Accessible.role: Accessible.StaticText
          Accessible.name: text
        }

        // UX-001: Play / Journey / World navigation — UxModel-driven, no dashboard
        RowLayout {
          Layout.alignment: Qt.AlignHCenter
          Layout.fillWidth: true
          spacing: Style.space(8)
          Repeater {
            model: ["Play", "Journey", "World"]
            delegate: Button {
              text: modelData
              focusable: true
              bordered: root.currentSurface() !== modelData
              Accessible.role: Accessible.Button
              Accessible.name: modelData + (root.currentSurface() === modelData ? " — current" : "")
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.stateStore.applyUxCommand({ type: "ux.navigate", surface: modelData })
            }
          }
          Button {
            text: root._reducedMotion ? "Motion: reduced" : "Motion: full"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            Accessible.name: text
            enabled: root.stateStore && !root.stateStore.saving
            onClicked: root.stateStore.applyUxCommand({ type: "ux.reducedMotion.set", enabled: !root._reducedMotion })
          }
        }

        Text {
          text: root.currentSurface() === "Play" ? "Play — your next action"
            : root.currentSurface() === "Journey" ? "Journey — your progress & kingdom"
            : "World — competition (local preview)"
          color: root.contentForeground
          opacity: 0.68
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption || Style.font.bodySmall
          Layout.alignment: Qt.AlignHCenter
          Accessible.role: Accessible.StaticText
        }

        // ——— Play surface — the next meaningful action without a dashboard ———
        ColumnLayout {
          visible: root.currentSurface() === "Play"
          Layout.fillWidth: true
          spacing: Style.space(8)

        Text {
          visible: root.activeSession && root.activeSession.plannedMinutes !== null
          text: visible ? (root.sessionSummary && root.sessionSummary.plannedDurationPassed
            ? "Plan passed · choose overtime credit when finishing"
            : "Plan: " + root.activeSession.plannedMinutes + " minutes") : ""
          color: root.sessionSummary && root.sessionSummary.plannedDurationPassed ? Color.urgent : root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
          Layout.alignment: Qt.AlignHCenter
          Accessible.role: Accessible.StaticText
        }

        Button {
          visible: root.activeSession && root.stateStore && root.stateStore.planningProjection.tasks.length > 0
          text: root.activeSession && root.activeSession.taskId ? "Change attached Task" : "Attach a Task"
          focusable: true
          bordered: false
          Accessible.role: Accessible.Button
          enabled: root.stateStore && !root.stateStore.saving
          Layout.alignment: Qt.AlignHCenter
          onClicked: root.cycleActiveTask()
        }

        RowLayout {
          visible: root.activeSession
          Layout.alignment: Qt.AlignHCenter
          spacing: Style.space(8)

          Button {
            text: root.activeSession && root.activeSession.status === "running" ? "Pause" : "Resume"
            focusable: true
            bordered: true
            Accessible.role: Accessible.Button
            enabled: root.stateStore && !root.stateStore.saving
            onClicked: root.sessionTransition(root.activeSession.status === "running" ? "session.pause" : "session.resume")
          }

          Button {
            text: "Finish"
            focusable: true
            bordered: true
            Accessible.role: Accessible.Button
            enabled: root.activeSession
              ? root.stateStore && !root.stateStore.saving && !root.activeSession.pendingInactivityStartedAtUtc
              : false
            onClicked: root.finishSession(undefined, false)
          }

          Button {
            text: "Discard"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            enabled: root.stateStore && !root.stateStore.saving
            onClicked: root.sessionTransition("session.discard")
          }
        }

        ColumnLayout {
          visible: root.activeSession && root.activeSession.pendingInactivityEndedAtUtc
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: "You were away. Count that interval as focused time?"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count it"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              onClicked: root.stateStore.applySessionCommand({
                type: "session.inactivity.resolve", atUtc: new Date().toISOString(), decision: "include"
              })
            }
            Button {
              text: "Exclude it"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              onClicked: root.stateStore.applySessionCommand({
                type: "session.inactivity.resolve", atUtc: new Date().toISOString(), decision: "exclude"
              })
            }
          }

        }

        ColumnLayout {
          visible: root.stateStore && root.stateStore.sessionConfirmation &&
            (root.activeSession || root.pendingCorrectionCommand)
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: root.confirmationText()
            color: Color.urgent
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          RowLayout {
            visible: root.hasConfirmationReason("planned-duration")
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count overtime"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              onClicked: root.pendingCorrectionCommand
                ? root.continueCorrection("include-overtime", false)
                : root.finishSession("include-overtime", true)
            }
            Button {
              text: "Use planned time"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              onClicked: root.pendingCorrectionCommand
                ? root.continueCorrection("exclude-overtime", false)
                : root.finishSession("exclude-overtime", true)
            }
          }

          Button {
            visible: !root.pendingCorrectionCommand && root.hasConfirmationReason("daily-cap") &&
              !root.hasConfirmationReason("planned-duration")
            text: "Accept competitive cap"
            focusable: true
            bordered: true
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.finishSession(undefined, true)
          }

          Button {
            visible: root.pendingCorrectionCommand && root.hasConfirmationReason("correction")
            text: "Apply correction"
            focusable: true
            bordered: true
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.continueCorrection(undefined, true)
          }
        }

        ColumnLayout {
          visible: !root.activeSession
          Layout.fillWidth: true
          spacing: Style.space(6)

          Repeater {
            model: root.stateStore ? root.stateStore.planningProjection.tasks : []
            delegate: Button {
              property var task: modelData
              text: (root.selection && root.selection.taskId === task.id ? "✓ " : "") + task.title
              focusable: true
              bordered: root.selection && root.selection.taskId === task.id
              Layout.fillWidth: true
              opacity: 1.0
              scale: 1.0
              Behavior on opacity { enabled: !root._reducedMotion; NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }
              Behavior on scale { enabled: !root._reducedMotion; NumberAnimation { duration: 120; easing.type: Easing.OutCubic } }
              Accessible.role: Accessible.Button
              onClicked: {
                scale = 0.97
                Qt.callLater(function(){ scale = 1.0 })
                root.selectTask(task)
              }
            }
          }

          Button {
            visible: root.selection && root.selectedTask()
            text: root.plannedModeText()
            focusable: true
            bordered: root.usePlannedDuration
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.usePlannedDuration = !root.usePlannedDuration
          }

          TextField {
            id: freePlanField
            width: Style.space(140)
            placeholderText: "planned min (blank = open)"
            foreground: root.contentForeground
            font.family: root.contentFontFamily
            inputMethodHints: Qt.ImhDigitsOnly
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.EditableText
          }

          Button {
            text: root.startButtonText()
            focusable: true
            bordered: true
            Accessible.role: Accessible.Button
            enabled: root.stateStore && root.stateStore.recordingReady && !root.stateStore.saving
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.startSession(false)
          }

          Button {
            visible: root.selection
            text: "Start free Session"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            enabled: root.stateStore && root.stateStore.recordingReady && !root.stateStore.saving
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.startSession(true)
          }

          Button {
            visible: root.selection && root.selection.reminderStatus === "due"
            text: "Dismiss reminder"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.stateStore.applySessionCommand({
              type: "selection.reminder.dismiss", atUtc: new Date().toISOString()
            })
          }
        }

        ColumnLayout {
          visible: !root.activeSession && root.recentSession && root.recentSession.status === "finished"
          Layout.fillWidth: true
          spacing: Style.space(6)

          Text {
            text: root.recentSessionText()
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            TextField {
              id: correctionDuration
              width: Style.space(82)
              placeholderText: "exact min"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              inputMethodHints: Qt.ImhFormattedNumbersOnly
              Accessible.role: Accessible.EditableText
            }
            TextField {
              id: correctionSkill
              width: Style.space(110)
              placeholderText: "skill (optional)"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              Accessible.role: Accessible.EditableText
            }
            TextField {
              id: correctionPlanned
              width: Style.space(82)
              placeholderText: "plan/open"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
              Accessible.role: Accessible.EditableText
            }
            Button {
              text: "Apply exact"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              enabled: root.stateStore && !root.stateStore.saving && correctionDuration.text !== ""
              onClicked: root.requestExactCorrection(
                correctionDuration.text, correctionSkill.text, correctionPlanned.text)
            }
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "−5 minutes"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.requestCorrection(-5, undefined)
            }
            Button {
              text: "+5 minutes"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.requestCorrection(5, undefined)
            }
          }


          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Older"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.correctionSessionOffset + 1 < root.finishedSessionCount()
              onClicked: root.correctionSessionOffset += 1
            }
            Button {
              text: "Newer"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.correctionSessionOffset > 0
              onClicked: root.correctionSessionOffset -= 1
            }
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: root.recentSession && root.recentSession.taskId ? "Change Task / Skill" : "Attach Task / Skill"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionTaskChange()
            }
            Button {
              text: "−5 planned"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionPlannedChange(-5)
            }
            Button {
              text: "+5 planned"
              focusable: true
              bordered: false
              Accessible.role: Accessible.Button
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionPlannedChange(5)
            }
          }
        }

        // Play — Today's occurrences + habits (PRD: one current activity is dominant, today visible without dashboard)
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(6)
          Text {
            text: "Today"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            font.bold: true
            Accessible.role: Accessible.StaticText
          }
          Text {
            visible: root.todayOccurrences().length === 0 && (!root.habitProjection || !root.habitProjection.habits || root.habitProjection.habits.length === 0)
            text: "No tasks scheduled for today. Add a Routine or Task to see it here."
            color: root.contentForeground
            opacity: 0.62
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            Accessible.role: Accessible.StaticText
          }
          Repeater {
            model: root.todayOccurrences()
            delegate: RowLayout {
              property var occ: modelData
              Layout.fillWidth: true
              spacing: Style.space(8)
              Text {
                text: occ ? occ.title : ""
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                Accessible.role: Accessible.StaticText
              }
              Text {
                text: occ ? occ.status : ""
                color: root.contentForeground
                opacity: 0.62
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption || Style.font.bodySmall
                Accessible.role: Accessible.StaticText
              }
            }
          }
          Repeater {
            model: root.habitProjection ? root.habitProjection.habits : []
            delegate: RowLayout {
              property var habit: modelData
              Layout.fillWidth: true
              spacing: Style.space(8)
              Text {
                text: habit ? ("◇ " + habit.title) : ""
                color: root.contentForeground
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
                Layout.fillWidth: true
                Accessible.role: Accessible.StaticText
              }
              Text {
                text: habit ? habit.status : ""
                color: root.contentForeground
                opacity: 0.62
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption || Style.font.bodySmall
                Accessible.role: Accessible.StaticText
              }
            }
          }
        }

        // Play — collapsed overdue area (folds, not intimidiating backlog)
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(4)
          visible: root.overdueOccurrences().length > 0
          Button {
            text: (root.playOverdueExpanded ? "▾ Overdue (" + root.overdueOccurrences().length + ")" : "▸ Overdue (" + root.overdueOccurrences().length + ") — collapsed")
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            Layout.fillWidth: true
            onClicked: root.playOverdueExpanded = !root.playOverdueExpanded
          }
          ColumnLayout {
            visible: root.playOverdueExpanded
            Layout.fillWidth: true
            spacing: Style.space(4)
            Repeater {
              model: root.overdueOccurrences()
              delegate: Text {
                property var occ: modelData
                text: occ ? (occ.title + " · " + occ.dailyXpDate + " · overdue") : ""
                color: root.contentForeground
                opacity: 0.72
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.caption || Style.font.bodySmall
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                Accessible.role: Accessible.StaticText
              }
            }
            Text {
              text: "Overdue folds — complete, reschedule, skip, dismiss, archive, or merge into today's equivalent. No duplicate XP."
              color: root.contentForeground
              opacity: 0.52
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              Accessible.role: Accessible.StaticText
            }
          }
        }

        } // end Play surface

        // ——— Journey surface — crest/level/rank, kingdom, achievements (no dashboard) ———
        ColumnLayout {
          visible: root.currentSurface() === "Journey"
          Layout.fillWidth: true
          spacing: Style.space(10)

          Button {
            text: root.isSheetOpen("progress-detail") ? "Hide progress detail" : "Show progress detail"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.toggleSheet("progress-detail")
          }

          ColumnLayout {
            visible: root.isSheetOpen("progress-detail")
            Layout.fillWidth: true
            spacing: Style.space(4)
            Rectangle { height: 1; color: Qt.rgba(1,1,1,0.08); Layout.fillWidth: true }
            Text {
              text: "Focused sheet — progress detail. Opened from Journey, closed without losing place. Interruptible."
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              Accessible.role: Accessible.StaticText
            }
            Button {
              text: "Close sheet"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              Layout.alignment: Qt.AlignHCenter
              onClicked: root.toggleSheet("progress-detail")
            }
          }

        // progression-ledger — PROG-001 executable surface: level/rank, Momentum, ledger with previewable calculation, Habit cap + Season farming guard, season reset
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle {
            height: 1
            color: Qt.rgba(1, 1, 1, 0.08)
            Layout.fillWidth: true
          }

          Text {
            text: "Progress"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          Text {
            text: root.progressionLevelText()
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.body
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: root.progressionTotalsText()
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: root.progressionProjection ? ("Momentum: " + root.progressionProjection.momentum) : "Momentum: Dormant"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            text: "Habit Season capped at 7/day (extras stay personal) \u00b7 Milestone Season 0 prevents farming \u00b7 Season reset preserves Lifetime"
            color: root.contentForeground
            opacity: 0.72
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Reset Season"
              focusable: true
              bordered: true
              enabled: root.stateStore && !root.stateStore.saving && root.progressionProjection && root.progressionProjection.totals && root.progressionProjection.totals.seasonXp > 0
              onClicked: root.stateStore.applyProgressionCommand({ type: "progression.season.reset" })
            }
            Text {
              visible: root.progressionProjection && root.progressionProjection.seasonId !== undefined
              text: visible ? ("Season " + root.progressionProjection.seasonId) : ""
              color: root.contentForeground
              opacity: 0.6
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
            }
          }

          Text {
            visible: !root.progressionProjection || !root.progressionProjection.ledger || root.progressionProjection.ledger.length === 0
            text: "No ledger entries yet. Complete a Session, habit, or milestone to earn rule-versioned XP."
            color: root.contentForeground
            opacity: 0.68
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          ColumnLayout {
            visible: root.progressionProjection && root.progressionProjection.ledger && root.progressionProjection.ledger.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)

            Text {
              text: "Ledger \u2014 each award once, previewable calculation"
              color: root.contentForeground
              opacity: 0.72
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              Layout.alignment: Qt.AlignHCenter
            }

            Repeater {
              model: root.progressionProjection ? root.progressionProjection.ledger : []
              delegate: ColumnLayout {
                property var entry: modelData
                Layout.fillWidth: true
                spacing: Style.space(2)
                Text {
                  text: root.progressionPreview(entry)
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
                Text {
                  visible: entry && entry.calculation
                  text: {
                    if (!entry || !entry.calculation) return ""
                    var c = entry.calculation
                    if (c.correction) return "calculation: correction"
                    if (c.minutes !== undefined) {
                      var parts = ["base " + c.base + " (1/min \u00b7 " + c.minutes + "m)"]
                      if (c.plannedBonus) parts.push("planned +" + c.plannedBonus)
                      if (c.dailyTargetBonus) parts.push("daily-target +" + c.dailyTargetBonus)
                      return "calculation: " + parts.join(" \u00b7 ")
                    }
                    if (c.habitId) return "calculation: habit " + c.habitId + " \u00b7 20 Lifetime"
                    if (c.significance !== undefined) return "calculation: significance " + c.significance + " \u00b7 " + c.award + " Lifetime, 0 Season (locked)"
                    if (c.fullSetBonus !== undefined) return "calculation: full set \u00b7 +" + c.fullSetBonus + " Lifetime, 0 Season"
                    if (c.seasonId !== undefined) return "calculation: Season " + c.seasonId
                    return "calculation: v" + (entry.ruleVersion || 1)
                  }
                  color: root.contentForeground
                  opacity: 0.58
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
              }
            }
          }
        }


        // kingdom— STORY-001 executable surface: provinces/landmarks, antagonists neutral, comeback quest 3 steps, Hollow King
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle {
            height: 1
            color: Qt.rgba(1, 1, 1, 0.08)
            Layout.fillWidth: true
          }

          Text {
            text: "Kingdom"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
          }

          Text {
            visible: !root.storyProjection || !root.storyProjection.provinces || root.storyProjection.provinces.length === 0
            text: "No provinces yet. Create a Goal to found your first province."
            color: root.contentForeground
            opacity: 0.68
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          ColumnLayout {
            visible: root.storyProjection && root.storyProjection.provinces && root.storyProjection.provinces.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)

            Repeater {
              model: root.storyProjection ? root.storyProjection.provinces : []
              delegate: ColumnLayout {
                property var province: modelData
                Layout.fillWidth: true
                spacing: Style.space(4)

                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(8)
                  Text {
                    text: province ? province.title : ""
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.body
                    font.bold: true
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                  }
                  Text {
                    text: province ? root.provinceLabel(province.status) : ""
                    color: root.contentForeground
                    opacity: 0.62
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                }

                Text {
                  visible: province && province.status === "ruins"
                  text: "Ruins — abandoned territory, nothing is lost permanently; reclaim by restoring the goal."
                  color: root.contentForeground
                  opacity: 0.6
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }

                Text {
                  visible: province && province.landmarks && province.landmarks.length === 0
                  text: "No landmarks yet."
                  color: root.contentForeground
                  opacity: 0.55
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  Layout.fillWidth: true
                }

                Repeater {
                  model: province && province.landmarks ? province.landmarks : []
                  delegate: RowLayout {
                    property var landmark: modelData
                    Layout.fillWidth: true
                    spacing: Style.space(6)
                    Text {
                      text: landmark ? landmark.title : ""
                      color: root.contentForeground
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.bodySmall
                      Layout.fillWidth: true
                      wrapMode: Text.Wrap
                    }
                    Text {
                      text: landmark ? (landmark.status === "built" ? "built" : "planned") : ""
                      color: root.contentForeground
                      opacity: 0.62
                      font.family: root.contentFontFamily
                      font.pixelSize: Style.font.caption || Style.font.bodySmall
                    }
                  }
                }
              }
            }
          }

          // Antagonists — neutral cause language, never insulting
          ColumnLayout {
            visible: root.storyProjection && root.storyProjection.antagonists && root.storyProjection.antagonists.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)
            Text {
              text: "Challenges — what caused them"
              color: root.contentForeground
              opacity: 0.72
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              font.bold: true
              Layout.alignment: Qt.AlignHCenter
            }
            Repeater {
              model: root.storyProjection ? root.storyProjection.antagonists : []
              delegate: ColumnLayout {
                property var foe: modelData
                Layout.fillWidth: true
                spacing: Style.space(2)
                Text {
                  text: foe ? foe.label : ""
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.bold: true
                }
                Text {
                  text: foe ? foe.cause : ""
                  color: root.contentForeground
                  opacity: 0.68
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
                Text {
                  visible: foe && foe.id === "hollow-king"
                  text: "Only unfinished provinces are affected."
                  color: root.contentForeground
                  opacity: 0.6
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
              }
            }
          }
          Text {
            visible: !root.storyProjection || !root.storyProjection.antagonists || root.storyProjection.antagonists.length === 0
            text: "No active challenges — neutral antagonists appear only when the underlying behaviour occurs."
            color: root.contentForeground
            opacity: 0.55
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          // Comeback Quest — appears after 7 inactive eligible days; 3 steps, reclaims province + Achievement, ignore has no punishment
          ColumnLayout {
            visible: root.storyProjection && root.storyProjection.comebackQuest
            Layout.fillWidth: true
            spacing: Style.space(6)

            Text {
              text: root.storyProjection && root.storyProjection.comebackQuest
                ? (root.storyProjection.comebackQuest.status === "completed" ? "Comeback Quest — reclaimed"
                  : root.storyProjection.comebackQuest.status === "ignored" ? "Comeback Quest — set aside"
                  : root.storyProjection.comebackQuest.status === "active" ? "Comeback Quest — in progress"
                  : "Comeback Quest — available") : "Comeback Quest"
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              font.bold: true
              Layout.alignment: Qt.AlignHCenter
            }

            Text {
              text: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.explains
                ? root.storyProjection.comebackQuest.explains : ""
              visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.explains
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }

            Repeater {
              model: root.storyProjection && root.storyProjection.comebackQuest ? root.storyProjection.comebackQuest.steps : []
              delegate: RowLayout {
                property var step: modelData
                Layout.fillWidth: true
                spacing: Style.space(8)
                Text {
                  text: step ? (step.completed ? "✓" : "○") : ""
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.bodySmall
                }
                ColumnLayout {
                  Layout.fillWidth: true
                  spacing: 2
                  Text {
                    text: step ? step.title : ""
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                  }
                  Text {
                    text: step ? step.required : ""
                    color: root.contentForeground
                    opacity: 0.58
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                    wrapMode: Text.Wrap
                    Layout.fillWidth: true
                  }
                }
              }
            }

            Text {
              text: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.reward
                ? ("Reward: " + root.storyProjection.comebackQuest.reward) : ""
              visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.reward
              color: root.contentForeground
              opacity: 0.64
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }

            Text {
              visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.status === "ignored"
              text: "Set aside — no punishment, no hidden loss. It remains available to reclaim."
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }

            RowLayout {
              Layout.alignment: Qt.AlignHCenter
              spacing: Style.space(8)
              Button {
                visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.status === "available"
                text: "Accept Quest"
                focusable: true
                bordered: true
                enabled: root.stateStore && !root.stateStore.saving
                onClicked: root.stateStore.applyStoryCommand({ type: "story.comeback.accept" })
              }
              Button {
                visible: root.storyProjection && root.storyProjection.comebackQuest && root.storyProjection.comebackQuest.status === "active"
                text: "Complete Quest"
                focusable: true
                bordered: true
                enabled: root.stateStore && !root.stateStore.saving
                onClicked: root.stateStore.applyStoryCommand({ type: "story.comeback.complete" })
              }
              Button {
                visible: root.storyProjection && root.storyProjection.comebackQuest && (root.storyProjection.comebackQuest.status === "available" || root.storyProjection.comebackQuest.status === "active")
                text: "Set aside"
                focusable: true
                bordered: false
                enabled: root.stateStore && !root.stateStore.saving
                onClicked: root.stateStore.applyStoryCommand({ type: "story.comeback.ignore" })
              }
            }
          }

          Text {
            visible: !root.storyProjection || !root.storyProjection.comebackQuest
            text: "Comeback Quest appears after 7 inactive eligible days — 3 forgiving steps. Success reclaims and grants an Achievement; setting it aside has no punishment or hidden loss."
            color: root.contentForeground
            opacity: 0.55
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          // Achievements (cosmetic) — icon + label, not color-only
          RowLayout {
            visible: root.storyProjection && root.storyProjection.achievements && root.storyProjection.achievements.length > 0
            Layout.fillWidth: true
            spacing: Style.space(6)
            Text {
              text: "◆"
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              Accessible.role: Accessible.StaticText
            }
            Text {
              text: {
                var a = root.storyProjection.achievements
                if (!a || a.length === 0) return ""
                return "Achievements: " + a.map(function(x){ return x.title }).join(" · ")
              }
              color: root.contentForeground
              opacity: 0.64
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              Accessible.role: Accessible.StaticText
            }
          }

          } // end kingdom section

        // statistics — INSIGHT-001 executable surface: period/skill aggregates
        // reconciled to Sessions + ledger, app-tracking consent, Recovery isolated.
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle { height: 1; color: Qt.rgba(1,1,1,0.08); Layout.fillWidth: true }

          Text {
            text: "Statistics"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          Button {
            text: root.isSheetOpen("statistics") ? "Hide statistics" : "Show statistics"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.toggleSheet("statistics")
          }

          // Empty state — truthful when there is no history yet.
          Text {
            visible: root.isSheetOpen("statistics") && (!root.stateStore.insightProjection ||
              !root.stateStore.insightProjection.stats || root.stateStore.insightProjection.stats.sessionCount === 0)
            text: "No finished Sessions yet. Statistics appear after you complete focus time."
            color: root.contentForeground
            opacity: 0.68
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          ColumnLayout {
            visible: root.isSheetOpen("statistics") && root.stateStore.insightProjection &&
              root.stateStore.insightProjection.stats && root.stateStore.insightProjection.stats.sessionCount > 0
            Layout.fillWidth: true
            spacing: Style.space(6)

            Text {
              text: "All time — reconciled with your Sessions and ledger"
              color: root.contentForeground
              opacity: 0.72
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              Layout.alignment: Qt.AlignHCenter
            }

            Text {
              text: {
                var st = root.stateStore.insightProjection.stats
                var mins = Math.round(st.totalFocusedMilliseconds / 60000)
                return "Focused " + mins + " min across " + st.sessionCount +
                  (st.sessionCount === 1 ? " session" : " sessions") + " · " + st.ledgerTotalXp + " XP lifetime"
              }
              color: root.contentForeground
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
              Accessible.role: Accessible.StaticText
            }

            Repeater {
              model: {
                var sums = root.stateStore.insightProjection.stats.sums.bySkill
                var keys = Object.keys(sums)
                keys.sort(function(a,b){ return sums[b] - sums[a] })
                return keys.map(function(k){ return { skill: k, minutes: Math.round(sums[k] / 60000) } })
              }
              delegate: RowLayout {
                required property var modelData
                Layout.fillWidth: true
                Text {
                  text: modelData.skill
                  color: root.contentForeground
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  Layout.fillWidth: true
                  elide: Text.ElideRight
                  Accessible.role: Accessible.StaticText
                }
                Text {
                  text: modelData.minutes + " min"
                  color: root.contentForeground
                  opacity: 0.78
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  Accessible.role: Accessible.StaticText
                }
              }
            }

            // Application tracking — off by default; consent names each app explicitly.
            Rectangle { height: 1; color: Qt.rgba(1,1,1,0.08); Layout.fillWidth: true }

            Text {
              text: "Application tracking — off by default. Only application names you allow are counted, locally, never content."
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
              Accessible.role: Accessible.StaticText
            }

            Button {
              readonly property bool consentEnabled: root.stateStore.insightProjection &&
                root.stateStore.insightProjection.consent.enabled
              text: consentEnabled ? "Disable application tracking" : "Enable application tracking"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              Layout.alignment: Qt.AlignHCenter
              onClicked: {
                if (consentEnabled) {
                  root.stateStore.applyInsightCommand({ type: "insight.consent.disable" })
                } else {
                  // Name-level consent: the panel lists what it would track and the
                  // user opts in by pressing enable. Names come from Session records.
                  var names = []
                  var seen = {}
                  var raw = root.stateStore.sessionProjection.sessions || []
                  for (var i = 0; i < raw.length; i += 1) {
                    var n = raw[i].applicationName
                    if (n && !seen[n]) { seen[n] = true; names.push(n) }
                  }
                  root.stateStore.applyInsightCommand({ type: "insight.consent.enable", applicationNames: names })
                }
              }
            }

            Text {
              visible: root.stateStore.insightProjection.consent.enabled &&
                Object.keys(root.stateStore.insightProjection.applications).length > 0
              text: {
                var apps = root.stateStore.insightProjection.applications
                var keys = Object.keys(apps)
                keys.sort(function(a,b){ return apps[b] - apps[a] })
                return keys.map(function(k){ return k + " " + Math.round(apps[k]/60000) + " min" }).join(" · ")
              }
              color: root.contentForeground
              opacity: 0.85
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
              Accessible.role: Accessible.StaticText
            }

            Text {
              text: "Recovery stays private — statistics never include Recovery details."
              color: root.contentForeground
              opacity: 0.56
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
              Accessible.role: Accessible.StaticText
            }

            Button {
              text: "Close sheet"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              Layout.alignment: Qt.AlignHCenter
              onClicked: root.toggleSheet("statistics")
            }
          }
        }

        // share — SHARE-001 executable surface: user-reviewed card preview with
        // per-field removal, real image export (grabToImage), copy, prepared
        // posts (never auto-post). Recovery cards only via the protected flow.
        ColumnLayout {
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle { height: 1; color: Qt.rgba(1,1,1,0.08); Layout.fillWidth: true }

          Text {
            text: "Share"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          Button {
            text: root.isSheetOpen("share") ? "Hide share cards" : "Show share cards"
            focusable: true
            bordered: false
            Accessible.role: Accessible.Button
            Layout.alignment: Qt.AlignHCenter
            onClicked: {
              // Seed a default draft the first time the sheet opens.
              if (!root.isSheetOpen("share") && !root.stateStore.shareProjection.draft)
                root.stateStore.applyShareCommand({ type: "share.draft.set", cardType: "skill" })
              root.toggleSheet("share")
            }
          }

          ColumnLayout {
            visible: root.isSheetOpen("share")
            Layout.fillWidth: true
            spacing: Style.space(6)

            // Card type selector — local types only; recovery excluded here.
            RowLayout {
              spacing: Style.space(4)
              Layout.alignment: Qt.AlignHCenter
              Repeater {
                model: ["skill", "period", "session", "progression", "habit", "goal"]
                delegate: Button {
                  required property var modelData
                  readonly property bool isCurrent: root.stateStore.shareProjection.draft &&
                    root.stateStore.shareProjection.draft.cardType === modelData
                  text: modelData
                  focusable: true
                  bordered: !isCurrent
                  Accessible.role: Accessible.Button
                  onClicked: root.stateStore.applyShareCommand({ type: "share.draft.set", cardType: modelData })
                }
              }
            }

            // Live preview — exactly what export renders. grabToImage turns THIS item into PNG.
            Rectangle {
              id: cardPreviewFrame
              readonly property var draft: root.stateStore.shareProjection.draft
              readonly property var previewCard: {
                if (!draft) return null
                var data = ShareModel.fieldsFor(draft.cardType, {
                  insightProjection: root.stateStore.insightProjection,
                  progressionProjection: root.stateStore.progressionProjection,
                  planningProjection: root.stateStore.planningProjection,
                  habitProjection: root.stateStore.habitProjection,
                  sessionProjection: root.stateStore.sessionProjection
                })
                if (!data) return null
                return ShareModel.createCard(draft.cardType, data, { removeFields: draft.removeFields })
              }
              visible: previewCard !== null
              color: Qt.rgba(0.06, 0.09, 0.16, 0.95)
              radius: Style.roundingSmall !== undefined ? Style.roundingSmall : 12
              Layout.fillWidth: true
              Layout.preferredHeight: cardPreview.implicitHeight + Style.space(24)
              Accessible.role: Accessible.StaticText

              ColumnLayout {
                id: cardPreview
                anchors.centerIn: parent
                width: parent.width - Style.space(24)
                spacing: Style.space(6)

                Text {
                  text: cardPreviewFrame.previewCard ? "DailyXP · " + cardPreviewFrame.previewCard.type : ""
                  color: root.contentForeground
                  opacity: 0.7
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  Layout.alignment: Qt.AlignHCenter
                }
                Repeater {
                  model: cardPreviewFrame.previewCard ? Object.keys(cardPreviewFrame.previewCard.fields) : []
                  delegate: Text {
                    required property var modelData
                    property string displayValue: {
                      var v = cardPreviewFrame.previewCard.fields[modelData]
                      return modelData === "minutes" || modelData === "totalFocusedMinutes"
                        ? v + " min focused" : String(v)
                    }
                    text: displayValue
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                    Layout.alignment: Qt.AlignHCenter
                  }
                }
                Text {
                  visible: cardPreviewFrame.previewCard ? cardPreviewFrame.previewCard.sample : false
                  text: "Sample – fictional data"
                  color: "#e0b34d"
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  font.bold: true
                  Layout.alignment: Qt.AlignHCenter
                }
                Text {
                  text: "Made with DailyXP"
                  color: root.contentForeground
                  opacity: 0.55
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  Layout.alignment: Qt.AlignHCenter
                }
              }

              // Sample-mode toggle lives on the frame so it never enters the exported image.
              Button {
                readonly property bool sampleOn: root.stateStore.shareProjection.draft &&
                  root.stateStore.shareProjection.draft.sampleMode
                text: sampleOn ? "Sample: ON" : "Sample: OFF"
                focusable: true
                bordered: true
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                Accessible.role: Accessible.Button
                onClicked: {
                  var d = root.stateStore.shareProjection.draft
                  root.stateStore.applyShareCommand({
                    type: "share.draft.set", cardType: d.cardType,
                    removeFields: d.removeFields, sampleMode: !d.sampleMode
                  })
                }
              }
            }

            Text {
              visible: root.stateStore.shareProjection.draft &&
                ShareModel.fieldsFor(root.stateStore.shareProjection.draft.cardType, {
                  insightProjection: root.stateStore.insightProjection,
                  progressionProjection: root.stateStore.progressionProjection,
                  planningProjection: root.stateStore.planningProjection,
                  habitProjection: root.stateStore.habitProjection,
                  sessionProjection: root.stateStore.sessionProjection
                }) === null
              text: "No data for this card type yet — complete a session or set a goal first."
              color: root.contentForeground
              opacity: 0.68
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
              Accessible.role: Accessible.StaticText
            }

            // Field removal — every field may be removed before export.
            Flow {
              readonly property var draft: root.stateStore.shareProjection.draft
              visible: draft !== null && cardPreviewFrame.previewCard !== null
              spacing: Style.space(4)
              Layout.fillWidth: true
              Repeater {
                model: cardPreviewFrame.previewCard ? Object.keys(cardPreviewFrame.previewCard.fields) : []
                delegate: Button {
                  required property var modelData
                  readonly property bool removed: root.stateStore.shareProjection.draft &&
                    root.stateStore.shareProjection.draft.removeFields.indexOf(modelData) !== -1
                  text: (removed ? "+ restore " : "× remove ") + modelData
                  focusable: true
                  bordered: !removed
                  Accessible.role: Accessible.Button
                  onClicked: root.stateStore.applyShareCommand({ type: "share.field.toggled", field: modelData })
                }
              }
            }

            // Export actions — save renders the preview to PNG via grabToImage;
            // copy puts card text on the clipboard; prepared posts open in browser.
            RowLayout {
              Layout.alignment: Qt.AlignHCenter
              spacing: Style.space(4)

              Button {
                text: "Save image"
                focusable: true
                bordered: true
                enabled: cardPreviewFrame.previewCard !== null
                Accessible.role: Accessible.Button
                onClicked: {
                  var card = cardPreviewFrame.previewCard
                  root.stateStore.ensureShareDir()
                  var grab = cardPreviewFrame.grabToImage(function(result) {
                    var path = root.stateStore.stateDir + "/share/" + card.type + "-" + Date.now() + ".png"
                    if (result.saveToFile(path)) {
                      root.stateStore.applyShareCommand({
                        type: "share.exported", action: "save", savedPath: path,
                        cardId: card.id, cardType: card.type,
                        previewedFields: Object.keys(card.fields),
                        sampleMode: card.sample
                      })
                    }
                  })
                }
              }

              Button {
                text: "Copy text"
                focusable: true
                bordered: true
                enabled: cardPreviewFrame.previewCard !== null
                Accessible.role: Accessible.Button
                onClicked: {
                  var card = cardPreviewFrame.previewCard
                  var lines = ["DailyXP · " + card.type]
                  Object.keys(card.fields).forEach(function(k) {
                    lines.push(k + ": " + card.fields[k])
                  })
                  lines.push("Made with DailyXP")
                  root.stateStore.copyShareCardText(lines.join("\n"))
                  root.stateStore.applyShareCommand({
                    type: "share.exported", action: "copy",
                    cardId: card.id, cardType: card.type,
                    previewedFields: Object.keys(card.fields),
                    sampleMode: card.sample
                  })
                }
              }

              Button {
                text: "Post to X"
                focusable: true
                bordered: true
                enabled: cardPreviewFrame.previewCard !== null
                Accessible.role: Accessible.Button
                onClicked: {
                  var card = cardPreviewFrame.previewCard
                  root.stateStore.openSharePostUrl(ShareModel.preparedPostUrl("x", card))
                  root.stateStore.applyShareCommand({
                    type: "share.exported", action: "preparePost", network: "x",
                    cardId: card.id, cardType: card.type,
                    previewedFields: Object.keys(card.fields),
                    sampleMode: card.sample
                  })
                }
              }

              Button {
                text: "LinkedIn"
                focusable: true
                bordered: true
                enabled: cardPreviewFrame.previewCard !== null
                Accessible.role: Accessible.Button
                onClicked: {
                  var card = cardPreviewFrame.previewCard
                  root.stateStore.openSharePostUrl(ShareModel.preparedPostUrl("linkedin", card))
                  root.stateStore.applyShareCommand({
                    type: "share.exported", action: "preparePost", network: "linkedin",
                    cardId: card.id, cardType: card.type,
                    previewedFields: Object.keys(card.fields),
                    sampleMode: card.sample
                  })
                }
              }

              Button {
                text: "Facebook"
                focusable: true
                bordered: true
                enabled: cardPreviewFrame.previewCard !== null
                Accessible.role: Accessible.Button
                onClicked: {
                  var card = cardPreviewFrame.previewCard
                  root.stateStore.openSharePostUrl(ShareModel.preparedPostUrl("facebook", card))
                  root.stateStore.applyShareCommand({
                    type: "share.exported", action: "preparePost", network: "facebook",
                    cardId: card.id, cardType: card.type,
                    previewedFields: Object.keys(card.fields),
                    sampleMode: card.sample
                  })
                }
              }
            }

            Text {
              text: "You review before anything leaves. Save and Copy stay local; post buttons open a pre-filled draft you send yourself. Never auto-posts."
              color: root.contentForeground
              opacity: 0.62
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
              Accessible.role: Accessible.StaticText
            }

            Button {
              text: "Close sheet"
              focusable: true
              bordered: true
              Accessible.role: Accessible.Button
              Layout.alignment: Qt.AlignHCenter
              onClicked: root.toggleSheet("share")
            }
          }
        }

          } // end Journey surface

        // ——— World surface — fixture/division placeholder, honest unavailable state ———
        ColumnLayout {
          visible: root.currentSurface() === "World"
          Layout.fillWidth: true
          spacing: Style.space(8)
          Rectangle { height: 1; color: Qt.rgba(1,1,1,0.08); Layout.fillWidth: true }
          Text {
            text: "World"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.StaticText
          }
          Text {
            text: "Fixture · Division · nearby ranks · Skill leagues — cloud-backed when available. Local preview keeps state honest."
            color: root.contentForeground
            opacity: 0.64
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            Accessible.role: Accessible.StaticText
          }
          Text {
            text: "Unavailable offline — your local progress, Sessions, Habits, and Recovery remain fully usable."
            color: root.contentForeground
            opacity: 0.56
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
            Accessible.role: Accessible.StaticText
          }
        }

        // recovery — RECOV-001 executable surface: private tracks, backdated start, check-ins, explicit relapse (no shame), restart, deletion scopes
        // Gated inside Journey as the protected Recovery entry (PRD: separate protected entry)
        ColumnLayout {
          visible: root.currentSurface() === "Journey"
          Layout.fillWidth: true
          spacing: Style.space(8)

          Rectangle { height: 1; color: Qt.rgba(1, 1, 1, 0.08); Layout.fillWidth: true }

          Text {
            text: "Recovery — protected entry"
            color: root.contentForeground
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.titleSmall || Style.font.title
            font.bold: true
            Layout.alignment: Qt.AlignHCenter
            Accessible.role: Accessible.StaticText
          }

          Text {
            text: "Private by default — Recovery stays local unless you explicitly share it. Check-ins do not control the counter."
            color: root.contentForeground
            opacity: 0.62
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption || Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          // Create — category + backdated startDate + optional custom label
          ColumnLayout {
            Layout.fillWidth: true
            spacing: Style.space(6)

            RowLayout {
              Layout.fillWidth: true
              spacing: Style.space(8)
              TextField {
                id: recovCategoryField
                placeholderText: "category (e.g. smoking, gaming, custom:…)"
                Layout.fillWidth: true
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }
              TextField {
                id: recovStartField
                placeholderText: "start YYYY-MM-DD"
                Layout.preferredWidth: Style.space(140)
                font.family: root.contentFontFamily
                font.pixelSize: Style.font.bodySmall
              }
            }

            TextField {
              id: recovCustomField
              visible: recovCategoryField.text.toLowerCase().indexOf("custom") === 0 || recovCategoryField.text.toLowerCase().indexOf("custom:") === 0
              placeholderText: "custom label (moderated category name)"
              Layout.fillWidth: true
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.bodySmall
            }

            Text {
              visible: root.stateStore && root.stateStore.errorMessage !== "" && root.stateStore.errorMessage.indexOf("recovery") !== -1
              text: root.stateStore ? root.stateStore.errorMessage : ""
              color: Color.urgent
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
            }

            Button {
              text: "Start private Track"
              focusable: true
              bordered: true
              enabled: root.stateStore && !root.stateStore.saving && recovCategoryField.text.trim() !== "" && recovStartField.text.trim() !== ""
              Layout.alignment: Qt.AlignHCenter
              onClicked: {
                var raw = recovCategoryField.text.trim()
                var cat = raw.toLowerCase()
                var custom = ""
                var actualCat = cat
                if (cat.indexOf("custom:") === 0) { custom = raw.slice(7).trim(); actualCat = "custom" }
                else if (cat === "custom") { custom = recovCustomField.text.trim(); actualCat = "custom" }
                var track = {
                  id: "track:" + Date.now() + ":" + Math.random().toString(36).slice(2, 6),
                  category: actualCat,
                  customCategory: custom || undefined,
                  startDate: recovStartField.text.trim(),
                  visibility: "private"
                }
                if (custom) track.customCategory = custom
                root.stateStore.applyRecoveryCommand({ type: "recovery.track.create", track: track })
              }
            }

            Text {
              text: "Backdated start is allowed — history is personal, not retroactive competitive Season XP."
              color: root.contentForeground
              opacity: 0.55
              font.family: root.contentFontFamily
              font.pixelSize: Style.font.caption || Style.font.bodySmall
              wrapMode: Text.Wrap
              Layout.fillWidth: true
              horizontalAlignment: Text.AlignHCenter
            }
          }

          // Tracks + attempts
          Text {
            visible: !root.stateStore || !root.stateStore.recoveryProjection || !root.stateStore.recoveryProjection.tracks || root.stateStore.recoveryProjection.tracks.length === 0
            text: "No Recovery Tracks yet."
            color: root.contentForeground
            opacity: 0.6
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.bodySmall
            wrapMode: Text.Wrap
            Layout.fillWidth: true
            horizontalAlignment: Text.AlignHCenter
          }

          ColumnLayout {
            visible: root.stateStore && root.stateStore.recoveryProjection && root.stateStore.recoveryProjection.tracks && root.stateStore.recoveryProjection.tracks.length > 0
            Layout.fillWidth: true
            spacing: Style.space(8)

            Repeater {
              model: root.stateStore ? root.stateStore.recoveryProjection.tracks : []
              delegate: ColumnLayout {
                property var track: modelData
                Layout.fillWidth: true
                spacing: Style.space(4)

                Rectangle { height: 1; color: Qt.rgba(1,1,1,0.06); Layout.fillWidth: true }

                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(6)
                  Text {
                    text: track ? (track.category === "custom" && track.customCategory ? track.customCategory : track.category) : ""
                    color: root.contentForeground
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.bodySmall
                    font.bold: true
                    Layout.fillWidth: true
                    wrapMode: Text.Wrap
                  }
                  Text {
                    text: track ? track.startDate : ""
                    color: root.contentForeground
                    opacity: 0.6
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                  Text {
                    text: "private"
                    color: root.contentForeground
                    opacity: 0.45
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                }

                // Current attempt status
                Text {
                  text: {
                    if (!track) return ""
                    var atts = root.stateStore.recoveryProjection.attempts || []
                    var cur = null
                    for (var i = 0; i < atts.length; i++) if (atts[i].trackId === track.id) cur = atts[i]
                    if (!cur) return "No attempt"
                    if (cur.status === "active") return "Ongoing attempt since " + cur.startDate + " — check-ins do not control the counter"
                    if (cur.status === "ended") return "Ended " + (cur.relapseDate || "") + " — restart when you choose"
                    return cur.status
                  }
                  color: root.contentForeground
                  opacity: 0.62
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }

                // Check-in — optional, does not control counter
                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(6)
                  TextField {
                    id: checkinDate
                    placeholderText: "check-in YYYY-MM-DD"
                    Layout.preferredWidth: Style.space(140)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                  TextField {
                    id: checkinMood
                    placeholderText: "mood (optional)"
                    Layout.fillWidth: true
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                  Button {
                    text: "Check in"
                    focusable: true
                    bordered: false
                    enabled: root.stateStore && !root.stateStore.saving && checkinDate.text.trim() !== ""
                    onClicked: root.stateStore.applyRecoveryCommand({
                      type: "recovery.checkin",
                      trackId: track.id,
                      dailyXpDate: checkinDate.text.trim(),
                      mood: checkinMood.text.trim() || undefined
                    })
                  }
                }

                // Explicit relapse — no shame language, preserves XP
                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(6)
                  TextField {
                    id: relapseDate
                    placeholderText: "relapse YYYY-MM-DD"
                    Layout.preferredWidth: Style.space(140)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                  Button {
                    text: "Mark relapse (explicit)"
                    focusable: true
                    bordered: true
                    enabled: {
                      if (!root.stateStore || root.stateStore.saving || !track) return false
                      var atts = root.stateStore.recoveryProjection.attempts || []
                      for (var i = 0; i < atts.length; i++) if (atts[i].trackId === track.id && atts[i].status === "active") return relapseDate.text.trim() !== ""
                      return false
                    }
                    onClicked: root.stateStore.applyRecoveryCommand({
                      type: "recovery.relapse",
                      trackId: track.id,
                      dailyXpDate: relapseDate.text.trim()
                    })
                  }
                }
                Text {
                  text: "Explicit relapse ends the attempt privately — earned progress is kept and a restart is offered. No shaming."
                  color: root.contentForeground
                  opacity: 0.5
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }

                // Restart — offered after relapse, or when no active attempt
                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(6)
                  TextField {
                    id: restartDate
                    placeholderText: "restart YYYY-MM-DD"
                    Layout.preferredWidth: Style.space(140)
                    font.family: root.contentFontFamily
                    font.pixelSize: Style.font.caption || Style.font.bodySmall
                  }
                  Button {
                    text: "Restart"
                    focusable: true
                    bordered: true
                    enabled: {
                      if (!root.stateStore || root.stateStore.saving || !track) return false
                      var atts2 = root.stateStore.recoveryProjection.attempts || []
                      for (var j = 0; j < atts2.length; j++) if (atts2[j].trackId === track.id && atts2[j].status === "active") return false
                      return restartDate.text.trim() !== ""
                    }
                    onClicked: root.stateStore.applyRecoveryCommand({
                      type: "recovery.restart",
                      trackId: track.id,
                      dailyXpDate: restartDate.text.trim()
                    })
                  }
                }

                // Deletion scopes — private local deletion
                RowLayout {
                  Layout.fillWidth: true
                  spacing: Style.space(6)
                  Button {
                    text: "Delete attempt"
                    focusable: true
                    bordered: false
                    enabled: {
                      if (!root.stateStore || root.stateStore.saving || !track) return false
                      var a = root.stateStore.recoveryProjection.attempts || []
                      for (var k = 0; k < a.length; k++) if (a[k].trackId === track.id) return true
                      return false
                    }
                    onClicked: {
                      var a2 = root.stateStore.recoveryProjection.attempts || []
                      var attId = ""
                      for (var k2 = 0; k2 < a2.length; k2++) if (a2[k2].trackId === track.id) attId = a2[k2].id
                      if (attId !== "") root.stateStore.applyRecoveryCommand({ type: "recovery.delete", trackId: track.id, scope: "attempt", attemptId: attId })
                    }
                  }
                  Button {
                    text: "Delete Track"
                    focusable: true
                    bordered: false
                    enabled: root.stateStore && !root.stateStore.saving && !!track
                    onClicked: root.stateStore.applyRecoveryCommand({ type: "recovery.delete", trackId: track.id, scope: "track" })
                  }
                }
                Text {
                  text: "Deletion removes the selected scope locally — projections and any export handle omit that data. See Recovery model."
                  color: root.contentForeground
                  opacity: 0.45
                  font.family: root.contentFontFamily
                  font.pixelSize: Style.font.caption || Style.font.bodySmall
                  wrapMode: Text.Wrap
                  Layout.fillWidth: true
                }
              }
            }

            // Delete all
            Button {
              text: "Delete all Recovery"
              focusable: true
              bordered: false
              Layout.alignment: Qt.AlignHCenter
              enabled: root.stateStore && !root.stateStore.saving && root.stateStore.recoveryProjection && root.stateStore.recoveryProjection.tracks && root.stateStore.recoveryProjection.tracks.length > 0
              onClicked: {
                var tid = root.stateStore.recoveryProjection.tracks[0].id
                root.stateStore.applyRecoveryCommand({ type: "recovery.delete", trackId: tid, scope: "all" })
              }
            }
          }
        }

        Text {
          visible: root.stateStore && root.stateStore.errorMessage !== ""
          text: visible ? root.stateStore.errorMessage : ""
          color: Color.urgent
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
          wrapMode: Text.Wrap
          Layout.fillWidth: true
          horizontalAlignment: Text.AlignHCenter
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
