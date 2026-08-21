import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui
import "EventModel.js" as EventModel
import "SessionModel.js" as SessionModel

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

  function startSession() {
    var task = selectedTask()
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

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: freePlanField.activeFocus || correctionDuration.activeFocus ||
        correctionSkill.activeFocus || correctionPlanned.activeFocus
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      ColumnLayout {
        id: content
        width: parent.width
        spacing: Style.space(12)

        Text {
          text: root.activeSession ? "Focused Session" : "Choose what matters now"
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.title
          font.bold: true
          Layout.alignment: Qt.AlignHCenter
        }

        Text {
          text: root.statusText()
          color: root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.body
          Layout.alignment: Qt.AlignHCenter
        }

        Text {
          visible: root.activeSession && root.activeSession.plannedMinutes !== null
          text: visible ? (root.sessionSummary && root.sessionSummary.plannedDurationPassed
            ? "Plan passed · choose overtime credit when finishing"
            : "Plan: " + root.activeSession.plannedMinutes + " minutes") : ""
          color: root.sessionSummary && root.sessionSummary.plannedDurationPassed ? Color.urgent : root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.bodySmall
          Layout.alignment: Qt.AlignHCenter
        }

        Button {
          visible: root.activeSession && root.stateStore && root.stateStore.planningProjection.tasks.length > 0
          text: root.activeSession && root.activeSession.taskId ? "Change attached Task" : "Attach a Task"
          focusable: true
          bordered: false
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
            enabled: root.stateStore && !root.stateStore.saving
            onClicked: root.sessionTransition(root.activeSession.status === "running" ? "session.pause" : "session.resume")
          }

          Button {
            text: "Finish"
            focusable: true
            bordered: true
            enabled: root.activeSession
              ? root.stateStore && !root.stateStore.saving && !root.activeSession.pendingInactivityStartedAtUtc
              : false
            onClicked: root.finishSession(undefined, false)
          }

          Button {
            text: "Discard"
            focusable: true
            bordered: false
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
          }

          RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count it"
              focusable: true
              bordered: true
              onClicked: root.stateStore.applySessionCommand({
                type: "session.inactivity.resolve", atUtc: new Date().toISOString(), decision: "include"
              })
            }
            Button {
              text: "Exclude it"
              focusable: true
              bordered: true
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
          }

          RowLayout {
            visible: root.hasConfirmationReason("planned-duration")
            Layout.alignment: Qt.AlignHCenter
            Button {
              text: "Count overtime"
              focusable: true
              bordered: true
              onClicked: root.pendingCorrectionCommand
                ? root.continueCorrection("include-overtime", false)
                : root.finishSession("include-overtime", true)
            }
            Button {
              text: "Use planned time"
              focusable: true
              bordered: true
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
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.finishSession(undefined, true)
          }

          Button {
            visible: root.pendingCorrectionCommand && root.hasConfirmationReason("correction")
            text: "Apply correction"
            focusable: true
            bordered: true
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
              onClicked: root.selectTask(task)
            }
          }

          Button {
            visible: root.selection && root.selectedTask()
            text: root.plannedModeText()
            focusable: true
            bordered: root.usePlannedDuration
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.usePlannedDuration = !root.usePlannedDuration
          }

          TextField {
            id: freePlanField
            visible: !root.selection
            width: Style.space(140)
            placeholderText: "planned min (blank = open)"
            foreground: root.contentForeground
            font.family: root.contentFontFamily
            inputMethodHints: Qt.ImhDigitsOnly
            Layout.alignment: Qt.AlignHCenter
          }

          Button {
            text: root.startButtonText()
            focusable: true
            bordered: true
            enabled: root.stateStore && root.stateStore.recordingReady && !root.stateStore.saving
            Layout.alignment: Qt.AlignHCenter
            onClicked: root.startSession()
          }

          Button {
            visible: root.selection && root.selection.reminderStatus === "due"
            text: "Dismiss reminder"
            focusable: true
            bordered: false
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
            }
            TextField {
              id: correctionSkill
              width: Style.space(110)
              placeholderText: "skill (optional)"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
            }
            TextField {
              id: correctionPlanned
              width: Style.space(82)
              placeholderText: "plan/open"
              foreground: root.contentForeground
              font.family: root.contentFontFamily
            }
            Button {
              text: "Apply exact"
              focusable: true
              bordered: true
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
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.requestCorrection(-5, undefined)
            }
            Button {
              text: "+5 minutes"
              focusable: true
              bordered: false
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
              enabled: root.correctionSessionOffset + 1 < root.finishedSessionCount()
              onClicked: root.correctionSessionOffset += 1
            }
            Button {
              text: "Newer"
              focusable: true
              bordered: false
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
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionTaskChange()
            }
            Button {
              text: "−5 planned"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionPlannedChange(-5)
            }
            Button {
              text: "+5 planned"
              focusable: true
              bordered: false
              enabled: root.stateStore && !root.stateStore.saving
              onClicked: root.correctionPlannedChange(5)
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
